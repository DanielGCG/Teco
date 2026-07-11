const DEATH_MESSAGES = {
  fome: [
    "morreu de fome.",
    "faleceu de inanição...",
    "foi visitar a Venezuela e foi de fome fome fome do caralho.",
    "não aguentou a barriga vazia e partiu.",
    "virou estrelinha por falta de comida."
  ],
  sede: [
    "morreu de sede.",
    "secou completamente.",
    "faleceu desidratado...",
    "virou pó por não beber água."
  ],
  limpeza: [
    "morreu por falta de higiene.",
    "se perdeu no meio da sujeira e morreu...",
    "comeu os próprios estafilococos e morreu...",
    "foi levado pelo lixão da vida..."
  ],
  loucura: [
    "enlouqueceu por falta de diversão.",
    "morreu de tédio agudo...",
    "perdeu a sanidade...",
    "virou betinha e morreu.",
    "foi de arrasta pra cima por falta de scrollada."
  ]
};

function getDeathMessage(pet) {
  if (!pet || !pet.deathCause) return "morreu.";
  const messages = DEATH_MESSAGES[pet.deathCause];
  if (!messages || !messages.length) return "morreu.";

  // Usa o ID do pet para sempre retornar a mesma mensagem para o mesmo pet (determinístico)
  const index = pet.id % messages.length;
  return messages[index];
}

const STAT_CONFIG = [
  { key: "fome", label: "fome" },
  { key: "sede", label: "sede" },
  { key: "limpeza", label: "limpeza" },
  { key: "sono", label: "sono" },
  { key: "diversao", label: "diversao" }
];

const DECAY_PER_SECOND = {
  fome: 100 / (24 * 3600),
  sede: 100 / (20 * 3600),
  limpeza: 100 / (36 * 3600),
  sono: 100 / (16 * 3600),
  diversao: 100 / (16 * 3600)
};

const SLEEP_RECOVERY_PER_SECOND = 100 / (8 * 3600);
const SLEEP_DECAY_FACTOR = 0.5;

const CLAIM_RELEASE_HOUR = 15;
const LOW_LEVEL_THRESHOLD = 30;

function clamp(value) {
  return Math.max(-100, Math.min(100, value));
}

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
      pet.deathCause = cause;
      pet.sleeping = false;
      if (!pet.diedAt) pet.diedAt = now; // Fallback se applyDecay não definiu
      return;
    }
  }
}

function applyDecay(pet, now = new Date()) {
  if (pet.dead) return pet;

  const lastUpdateDate = new Date(pet.lastUpdate);
  const elapsedSeconds = (now.getTime() - lastUpdateDate.getTime()) / 1000;
  if (elapsedSeconds <= 0) return pet;

  // Calculando o tempo exato de morte
  let earliestDeathTime = Infinity;
  let deathCause = null;

  const checkExactDeath = (key, cause, initialValue, decayRate) => {
    if (decayRate > 0) {
      const secondsToDie = (initialValue - (-100)) / decayRate;
      if (secondsToDie > 0 && secondsToDie <= elapsedSeconds) {
        if (secondsToDie < earliestDeathTime) {
          earliestDeathTime = secondsToDie;
          deathCause = cause;
        }
      }
    }
  };

  if (pet.sleeping) {
    pet.sono = clamp(pet.sono + SLEEP_RECOVERY_PER_SECOND * elapsedSeconds);
    pet.fome = clamp(pet.fome - DECAY_PER_SECOND.fome * SLEEP_DECAY_FACTOR * elapsedSeconds);
    pet.sede = clamp(pet.sede - DECAY_PER_SECOND.sede * SLEEP_DECAY_FACTOR * elapsedSeconds);

    checkExactDeath('fome', 'fome', pet.fome + (DECAY_PER_SECOND.fome * SLEEP_DECAY_FACTOR * elapsedSeconds), DECAY_PER_SECOND.fome * SLEEP_DECAY_FACTOR);
    checkExactDeath('sede', 'sede', pet.sede + (DECAY_PER_SECOND.sede * SLEEP_DECAY_FACTOR * elapsedSeconds), DECAY_PER_SECOND.sede * SLEEP_DECAY_FACTOR);

    if (pet.sono >= 100) pet.sleeping = false;
  } else {
    const oldFome = pet.fome;
    const oldSede = pet.sede;
    const oldLimpeza = pet.limpeza;
    const oldDiversao = pet.diversao;

    pet.fome = clamp(pet.fome - DECAY_PER_SECOND.fome * elapsedSeconds);
    pet.sede = clamp(pet.sede - DECAY_PER_SECOND.sede * elapsedSeconds);
    pet.limpeza = clamp(pet.limpeza - DECAY_PER_SECOND.limpeza * elapsedSeconds);
    pet.sono = clamp(pet.sono - DECAY_PER_SECOND.sono * elapsedSeconds);
    pet.diversao = clamp(pet.diversao - DECAY_PER_SECOND.diversao * elapsedSeconds);

    checkExactDeath('fome', 'fome', oldFome, DECAY_PER_SECOND.fome);
    checkExactDeath('sede', 'sede', oldSede, DECAY_PER_SECOND.sede);
    checkExactDeath('limpeza', 'limpeza', oldLimpeza, DECAY_PER_SECOND.limpeza);
    checkExactDeath('diversao', 'loucura', oldDiversao, DECAY_PER_SECOND.diversao);
  }

  if (earliestDeathTime !== Infinity && !pet.dead) {
    pet.dead = true;
    pet.diedAt = new Date(lastUpdateDate.getTime() + earliestDeathTime * 1000);
    pet.deathCause = deathCause;
    pet.sleeping = false;
  }

  pet.lastUpdate = now;
  checkDeath(pet, now); // Double check just in case
  return pet;
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

module.exports = {
  DEATH_MESSAGES,
  STAT_CONFIG,
  DECAY_PER_SECOND,
  SLEEP_RECOVERY_PER_SECOND,
  SLEEP_DECAY_FACTOR,
  CLAIM_RELEASE_HOUR,
  LOW_LEVEL_THRESHOLD,
  clamp,
  checkDeath,
  applyDecay,
  toIsoDateUTC,
  getBrasiliaDateParts,
  shiftDateKey,
  dateKeyToBrDateTime,
  getClaimCycleKey,
  getNextClaimAtFromNow,
  formatDateTimePtBr,
  getClaimInfo,
  getDeathMessage
};
