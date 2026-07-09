const express = require("express");
const GotchiRouter = express.Router();
const { Pet, Item, PetInventory, SystemConfig } = require("../models");

// Clamp agora aceita descer até -100
function clamp(value) {
  return Math.max(-100, Math.min(100, value));
}

// Taxas originais de decaimento mantidas (demora o dobro para morrer)
const DECAY_PER_SECOND = {
  fome:     100 / (24 * 3600),
  sede:     100 / (20 * 3600),
  limpeza:  100 / (36 * 3600),
  sono:     100 / (16 * 3600),
  diversao: 100 / (16 * 3600)
};

const SLEEP_RECOVERY_PER_SECOND = 100 / (8 * 3600);
const SLEEP_DECAY_FACTOR = 0.5;

const CLAIM_RELEASE_HOUR = 15;
const LOW_LEVEL_THRESHOLD = 30;

const DEATH_MESSAGES = {
  fome: "morreu de fome.",
  sede: "morreu de sede.",
  limpeza: "morreu por falta de higiene.",
  loucura: "enlouqueceu por falta de diversao."
};

const STAT_CONFIG = [
  { key: "fome", label: "fome" },
  { key: "sede", label: "sede" },
  { key: "limpeza", label: "limpeza" },
  { key: "sono", label: "sono" },
  { key: "diversao", label: "diversao" }
];

// Lógica de decaimento
function applyDecay(pet, now = new Date()) {
  if (pet.dead) return pet;

  const elapsedSeconds = (now.getTime() - new Date(pet.lastUpdate).getTime()) / 1000;
  if (elapsedSeconds <= 0) return pet;

  if (pet.sleeping) {
    pet.sono = clamp(pet.sono + SLEEP_RECOVERY_PER_SECOND * elapsedSeconds);
    pet.fome = clamp(pet.fome - DECAY_PER_SECOND.fome * SLEEP_DECAY_FACTOR * elapsedSeconds);
    pet.sede = clamp(pet.sede - DECAY_PER_SECOND.sede * SLEEP_DECAY_FACTOR * elapsedSeconds);
    if (pet.sono >= 100) pet.sleeping = false;
  } else {
    pet.fome     = clamp(pet.fome     - DECAY_PER_SECOND.fome     * elapsedSeconds);
    pet.sede     = clamp(pet.sede     - DECAY_PER_SECOND.sede     * elapsedSeconds);
    pet.limpeza  = clamp(pet.limpeza  - DECAY_PER_SECOND.limpeza  * elapsedSeconds);
    pet.sono     = clamp(pet.sono     - DECAY_PER_SECOND.sono     * elapsedSeconds);
    pet.diversao = clamp(pet.diversao - DECAY_PER_SECOND.diversao * elapsedSeconds);
  }

  pet.lastUpdate = now;
  checkDeath(pet, now);
  return pet;
}

// Agora a morte checa se o valor chegou em -100
function checkDeath(pet, now) {
  if (pet.dead) return;
  const checks = [
    { key: 'fome', cause: 'fome' },
    { key: 'sede', cause: 'sede' },
    { key: 'limpeza', cause: 'limpeza' },
    { key: 'diversao', cause: 'loucura' }
  ];

  for (const { key, cause } of checks) {
    if (pet[key] <= -100) {
      pet.dead = true;
      pet.diedAt = now;
      pet.deathCause = cause;
      pet.sleeping = false;
      return;
    }
  }
}

// Helpers de tempo
function toIsoDateUTC(date = new Date()) { return date.toISOString().slice(0, 10); }
function getBrasiliaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const map = {};
  parts.forEach((part) => { if (part.type !== "literal") map[part.type] = part.value; });
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), hour: Number(map.hour), minute: Number(map.minute), second: Number(map.second) };
}
function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return String(utc.getUTCFullYear()) + "-" + String(utc.getUTCMonth() + 1).padStart(2, "0") + "-" + String(utc.getUTCDate()).padStart(2, "0");
}
function dateKeyToBrDateTime(dateKey, hour = CLAIM_RELEASE_HOUR) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 3, 0, 0));
}
function getClaimCycleKey(now = new Date()) {
  const br = getBrasiliaDateParts(now);
  const brKey = String(br.year) + "-" + String(br.month).padStart(2, "0") + "-" + String(br.day).padStart(2, "0");
  return br.hour < CLAIM_RELEASE_HOUR ? shiftDateKey(brKey, -1) : brKey;
}
function getNextClaimAtFromNow(now = new Date()) {
  const br = getBrasiliaDateParts(now);
  const brKey = String(br.year) + "-" + String(br.month).padStart(2, "0") + "-" + String(br.day).padStart(2, "0");
  const targetDateKey = br.hour < CLAIM_RELEASE_HOUR ? brKey : shiftDateKey(brKey, 1);
  return dateKeyToBrDateTime(targetDateKey, CLAIM_RELEASE_HOUR);
}
function formatDateTimePtBr(dateLike) {
  if (!dateLike) return "";
  return new Date(dateLike).toLocaleString("pt-BR");
}

function getClaimInfo(pet, now = new Date()) {
  const cycleKey = getClaimCycleKey(now);
  const canClaim = pet.lastDailyClaim !== cycleKey;
  const nextClaimAt = getNextClaimAtFromNow(now);
  
  const br = getBrasiliaDateParts(now);
  const diaResgate = br.hour < CLAIM_RELEASE_HOUR ? "hoje" : "amanhã";

  return {
    cycleKey, 
    canClaim, 
    nextClaimAt,
    nextClaimLabel: "",
    availabilityLabel: canClaim 
        ? "resgate disponivel" 
        : `resgate de novo ${diaResgate} às ${CLAIM_RELEASE_HOUR}h`
  };
}

function getStatusText(pet) {
  if (pet.dead) return pet.name + " " + (DEATH_MESSAGES[pet.deathCause] || "morreu.");
  if (pet.sleeping) return pet.name + " esta dormindo...";
  const avg = (pet.fome + pet.sede + pet.limpeza + pet.sono + pet.diversao) / 5;
  const lowest = Math.min(pet.fome, pet.sede, pet.limpeza, pet.sono, pet.diversao);
  if (lowest < 25) return pet.name + " precisando de atencao!";
  if (avg > 65) return pet.name + " esta bem!";
  return pet.name + " esta mais ou menos...";
}

function buildPetUI(pet, now = new Date()) {
  const claimInfo = getClaimInfo(pet, now);
  const statValues = STAT_CONFIG.map(({ key }) => pet[key]);
  const lowest = Math.min(...statValues);
  const isDanger = pet.dead || lowest < LOW_LEVEL_THRESHOLD;
  const isSleeping = !!pet.sleeping;

  const inventoryButtons = [];
  const inventory = pet.inventory || [];
  
  inventory.forEach(inv => {
    if (inv.quantity > 0) {
        const item = inv.item;
        let effectText = `+${item.value} `;
        if (item.type === 'food') effectText += 'fome';
        if (item.type === 'water') effectText += 'sede';
        if (item.type === 'soap') effectText += 'limpeza';
        if (item.type === 'toy') effectText += 'diversao';

        inventoryButtons.push({
            id: item.publicid, // <---- AQUI: Enviamos o publicid para o front identificar o botão
            label: (item.emoji ? item.emoji + " " : "") + item.name + " (x" + inv.quantity + ")",
            stock: inv.quantity,
            effectText: effectText,
            disabled: isSleeping,
            disabledReason: isSleeping ? "indisponivel enquanto dorme" : ""
        });
    }
  });

  const actionButtons = [{
    id: "sleep",
    label: pet.sleeping ? "acordar" : "dormir",
    effectText: "recupera sono enquanto dorme",
    disabled: false,
    disabledReason: ""
  }];

  return {
    statusText: getStatusText(pet),
    sleepIndicator: pet.sleeping ? "zzz" : "",
    stockText: "", // Removido texto estático
    isDanger,
    isDead: pet.dead,
    isSleeping,
    deathCauseText: pet.dead ? (pet.name + " " + (DEATH_MESSAGES[pet.deathCause] || "morreu.")) : "",
    deathDateText: pet.dead && pet.diedAt ? ("em " + formatDateTimePtBr(pet.diedAt)) : "",
    stats: STAT_CONFIG.map(({ key, label }) => {
      // Visualmente não mostra negativo na barra
      const visualValue = Math.max(0, pet[key]);
      const actualValue = Math.round(pet[key]);
      return {
        key,
        label,
        value: visualValue,
        valueLabel: actualValue + "/100",
        isLow: actualValue < LOW_LEVEL_THRESHOLD
      };
    }),
    buttonGroups: {
      inventory: {
        title: "itens de inventario",
        buttons: inventoryButtons.length ? inventoryButtons : [{ id: "none", label: "vazio", disabled: true, effectText: "sem itens" }]
      },
      actions: {
        title: "acoes",
        buttons: actionButtons
      }
    },
    claim: {
      id: "claim",
      canClaim: claimInfo.canClaim,
      label: claimInfo.canClaim ? "resgatar pacote diario" : "resgatar (indisponivel)",
      nextLabel: claimInfo.nextClaimLabel,
      availabilityLabel: claimInfo.availabilityLabel,
      disabled: !claimInfo.canClaim
    }
  };
}

function sendPet(res, pet, statusCode = 200, extra = {}) {
  return res.status(statusCode).json({
    pet,
    ui: buildPetUI(pet, new Date()),
    ...extra
  });
}

async function getCurrentPet(userId) {
  return Pet.findOne({ 
    where: { userId, dead: false }, 
    order: [["id", "DESC"]],
    include: [{
        model: PetInventory,
        as: 'inventory',
        include: [{ model: Item, as: 'item' }]
    }]
  });
}

async function getDeadPets(userId) {
  return Pet.findAll({
    where: { userId, dead: true },
    order: [["diedAt", "DESC"], ["id", "DESC"]]
  });
}

// Rotas
GotchiRouter.get("/", async (req, res) => {
  const pet = await getCurrentPet(req.user.id);
  if (!pet) {
    const deadCount = await Pet.count({ where: { userId: req.user.id, dead: true } });
    return res.json({ exists: false, canCreate: true, deadCount });
  }
  applyDecay(pet, new Date());
  await pet.save();
  return sendPet(res, pet, 200, { exists: true, canCreate: false });
});

GotchiRouter.post("/", async (req, res) => {
  const existing = await getCurrentPet(req.user.id);
  if (existing) {
    applyDecay(existing, new Date());
    await existing.save();
    return sendPet(res, existing, 409, {
      error: "Voce ja tem um pet vivo. Cuide dele antes de criar outro.",
      exists: true,
      canCreate: false
    });
  }
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Nome e obrigatorio" });
  
  await Pet.create({ userId: req.user.id, name: name.trim() });
  const reloadedPet = await getCurrentPet(req.user.id);
  return sendPet(res, reloadedPet, 201, { exists: true, canCreate: false });
});

GotchiRouter.post("/claim", async (req, res) => {
  const pet = await getCurrentPet(req.user.id);
  if (!pet) return res.status(404).json({ error: "Pet nao encontrado" });
  
  applyDecay(pet, new Date());
  if (pet.dead) {
    await pet.save();
    return sendPet(res, pet, 409, { error: "Esse pet morreu. Crie um novo pet para continuar." });
  }
  const claimInfo = getClaimInfo(pet, new Date());
  if (!claimInfo.canClaim) {
    await pet.save();
    return sendPet(res, pet, 409, { error: "Resgate ja realizado hoje" });
  }
  
  const config = await SystemConfig.findOne({ where: { key: 'gotchi_daily_claim' } });
  const claimItems = config ? JSON.parse(config.value || '[]') : [];

  for (const reward of claimItems) {
     // AQUI: Agora ele busca pelo nome humanizado configurado pelo Admin
     const itemRecord = await Item.findOne({ where: { name: reward.name } });
     
     if (itemRecord) {
         const [inv] = await PetInventory.findOrCreate({ 
            where: { petId: pet.id, itemId: itemRecord.id },
            defaults: { quantity: 0 }
         });
         inv.quantity += reward.quantity;
         await inv.save();
     }
  }

  pet.lastDailyClaim = getClaimCycleKey(new Date());
  await pet.save();
  
  const updatedPet = await getCurrentPet(req.user.id);
  return sendPet(res, updatedPet, 200, { message: "Itens resgatados com sucesso" });
});

// Ação de usar Item
GotchiRouter.post("/use-item/:publicid", async (req, res) => {
    const pet = await getCurrentPet(req.user.id);
    if (!pet) return res.status(404).json({ error: "Pet nao encontrado" });
    
    applyDecay(pet, new Date());
    if (pet.dead) {
        await pet.save();
        return sendPet(res, pet, 409, { error: "Esse pet morreu. Crie um novo pet para continuar." });
    }
    if (pet.sleeping) {
        await pet.save();
        return sendPet(res, pet, 409, { error: "Pet esta dormindo" });
    }

    // Procura o item real usando o publicid seguro
    const item = await Item.findOne({ where: { publicid: req.params.publicid } });
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    // Pega do inventário usando o ID real interno
    const inv = await PetInventory.findOne({ 
        where: { petId: pet.id, itemId: item.id } 
    });

    if (!inv || inv.quantity < 1) {
        await pet.save();
        return sendPet(res, pet, 409, { error: "Item insuficiente no estoque" });
    }

    if (item.type === 'food') pet.fome = clamp(pet.fome + item.value);
    if (item.type === 'water') pet.sede = clamp(pet.sede + item.value);
    if (item.type === 'soap') pet.limpeza = clamp(pet.limpeza + item.value);
    if (item.type === 'toy') pet.diversao = clamp(pet.diversao + item.value);

    inv.quantity -= 1;
    await inv.save();
    await pet.save();

    const updatedPet = await getCurrentPet(req.user.id);
    return sendPet(res, updatedPet);
});

GotchiRouter.post("/sleep", async (req, res) => {
    const pet = await getCurrentPet(req.user.id);
    if (!pet) return res.status(404).json({ error: "Pet nao encontrado" });
    
    applyDecay(pet, new Date());
    if (pet.dead) {
        await pet.save();
        return sendPet(res, pet, 409, { error: "Esse pet morreu. Crie um novo pet para continuar." });
    }

    pet.sleeping = !pet.sleeping;
    await pet.save();

    const updatedPet = await getCurrentPet(req.user.id);
    return sendPet(res, updatedPet);
});

GotchiRouter.get("/cemetery", async (req, res) => {
  const deadPets = await getDeadPets(req.user.id);
  const pets = deadPets.map((pet) => ({
    publicid: pet.publicid,
    name: "  - " + pet.name,
    deathCause: pet.deathCause,
    deathText: DEATH_MESSAGES[pet.deathCause] || "morreu.",
    diedAt: pet.diedAt,
    diedAtLabel: pet.diedAt ? formatDateTimePtBr(pet.diedAt) : "-",
    createdat: pet.createdat
  }));
  return res.json({
    total: pets.length,
    pets
  });
});

module.exports = GotchiRouter;