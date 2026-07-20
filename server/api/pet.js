const express = require("express");
const GotchiRouter = express.Router();
const { Pet, Item, PetInventory, SystemConfig } = require("../models");
const {
  getDeathMessage,
  STAT_CONFIG,
  LOW_LEVEL_THRESHOLD,
  applyDecay,
  getClaimCycleKey,
  formatDateTimePtBr,
  getClaimInfo
} = require("../utils/petLogic");

function getStatusText(pet) {
  if (pet.dead) return pet.name + " " + getDeathMessage(pet);
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
            id: item.publicid,
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
    deathCauseText: pet.dead ? (pet.name + " " + getDeathMessage(pet)) : "",
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

    const { clamp } = require("../utils/petLogic");
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
    deathText: getDeathMessage(pet),
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