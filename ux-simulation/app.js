const catalog = {
  LOSARTANA: {
    name: "LOSARTANA",
    principle: "Losartana potássica",
    route: "VO",
    group: "GROUP_I",
    protocol: "Grupo I padrão",
    rules: ["2x ao dia", "Café e jantar"],
    frequency: 2,
    steps: [
      { label: "D1", anchor: "breakfast", offset: 0 },
      { label: "D2", anchor: "dinner", offset: 0 },
    ],
  },
  ALENDRONATO: {
    name: "ALENDRONATO",
    principle: "Alendronato de sódio",
    route: "VO",
    group: "GROUP_II_BIFOS",
    protocol: "Bifosfonato semanal",
    rules: ["Semanal", "Acordar - 1h", "Não deslocável"],
    frequency: 1,
    steps: [{ label: "D1", anchor: "wake", offset: -60 }],
    nonMovable: true,
  },
  DORALGINA: {
    name: "DORALGINA",
    principle: "Dipirona + associação",
    route: "VO",
    group: "GROUP_I",
    protocol: "6/6h se dor",
    rules: ["PRN", "6/6h", "6 dias"],
    frequency: 4,
    recurrence: "Em caso de dor",
    steps: [
      { label: "D1", anchor: "wake", offset: 0 },
      { label: "D2", anchor: "wake", offset: 360 },
      { label: "D3", anchor: "wake", offset: 720 },
      { label: "D4", anchor: "wake", offset: 1080 },
    ],
  },
  SUCRAFILM: {
    name: "SUCRAFILM",
    principle: "Sucralfato",
    route: "VO",
    group: "GROUP_II_SUCRA",
    protocol: "Sucralfato 2x ao dia",
    rules: ["Acordar + 2h", "Dormir", "Regra especial"],
    frequency: 2,
    steps: [
      { label: "D1", anchor: "wake", offset: 120 },
      { label: "D2", anchor: "sleep", offset: 0 },
    ],
  },
  ZOLPIDEM: {
    name: "ZOLPIDEM",
    principle: "Zolpidem",
    route: "VO",
    group: "GROUP_I_SED",
    protocol: "Ao dormir",
    rules: ["Dormir", "Bloqueia sucralfato"],
    frequency: 1,
    steps: [{ label: "D1", anchor: "sleep", offset: 0 }],
    blocksSucralfate: true,
  },
  CALCIO: {
    name: "CÁLCIO",
    principle: "Carbonato de cálcio",
    route: "VO",
    group: "GROUP_III_CALC",
    protocol: "Café + 3h",
    rules: ["Café + 3h", "Pode deslocar"],
    frequency: 1,
    steps: [{ label: "D1", anchor: "breakfast", offset: 180 }],
  },
};

const presets = {
  baseline: ["LOSARTANA", "ALENDRONATO", "DORALGINA"],
  conflict: ["LOSARTANA", "SUCRAFILM", "ZOLPIDEM", "CALCIO"],
  manual: ["LOSARTANA", "ALENDRONATO"],
};

const stepTitles = {
  patient: "Cadastro do paciente",
  routine: "Rotina do paciente",
  prescription: "Montagem da prescrição",
  calendar: "Calendário gerado",
};

let state = {
  currentStep: "patient",
  selectedPreset: "baseline",
  patientSaved: false,
  routineSaved: false,
  prescriptionSaved: false,
  selectedDoseId: null,
  manualTargetId: null,
  schedule: [],
};

const elements = {
  screenTitle: document.querySelector("#screenTitle"),
  flowSteps: [...document.querySelectorAll(".flow-step")],
  screens: [...document.querySelectorAll(".screen")],
  auditPatient: document.querySelector("#auditPatient"),
  auditRoutine: document.querySelector("#auditRoutine"),
  auditSchedule: document.querySelector("#auditSchedule"),
  patientStatus: document.querySelector("#patientStatus"),
  routineStatus: document.querySelector("#routineStatus"),
  prescriptionStatus: document.querySelector("#prescriptionStatus"),
  medicationList: document.querySelector("#medicationList"),
  routineTimeline: document.querySelector("#routineTimeline"),
  dayStrip: document.querySelector("#dayStrip"),
  doseBoard: document.querySelector("#doseBoard"),
  doseDetails: document.querySelector("#doseDetails"),
  calendarPatientName: document.querySelector("#calendarPatientName"),
  manualDialog: document.querySelector("#manualDialog"),
  manualSummary: document.querySelector("#manualSummary"),
  manualTimeInput: document.querySelector("#manualTimeInput"),
  manualReason: document.querySelector("#manualReason"),
};

function readPatient() {
  return {
    name: valueOf("patientName"),
    birthDate: valueOf("birthDate"),
    cpf: valueOf("cpf"),
    phone: valueOf("phone"),
  };
}

function readRoutine() {
  return {
    wake: valueOf("wakeTime"),
    breakfast: valueOf("breakfastTime"),
    lunch: valueOf("lunchTime"),
    snack: valueOf("snackTime"),
    dinner: valueOf("dinnerTime"),
    sleep: valueOf("sleepTime"),
    bath: valueOf("bathTime"),
  };
}

function valueOf(id) {
  return document.querySelector(`#${id}`).value;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(total) {
  let minutes = total % 1440;
  if (minutes < 0) minutes += 1440;
  if (total === 1440) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function routineAnchors() {
  const routine = readRoutine();
  return Object.fromEntries(
    Object.entries(routine).map(([key, value]) => [key, toMinutes(value)]),
  );
}

function selectedMedications() {
  return presets[state.selectedPreset].map((key) => catalog[key]);
}

function buildSchedule() {
  const anchors = routineAnchors();
  const rawDoses = selectedMedications().flatMap((medication) =>
    medication.steps.map((step) => ({
      id: `${medication.name}-${step.label}`,
      medication: medication.name,
      principle: medication.principle,
      group: medication.group,
      route: medication.route,
      protocol: medication.protocol,
      label: step.label,
      anchor: step.anchor,
      offset: step.offset,
      originalTime: anchors[step.anchor] + step.offset,
      time: anchors[step.anchor] + step.offset,
      status: "ACTIVE",
      reason: "Horário calculado pela fórmula clínica.",
      recurrence: medication.recurrence || "Diário",
      nonMovable: Boolean(medication.nonMovable),
      blocksSucralfate: Boolean(medication.blocksSucralfate),
      manual: false,
    })),
  );

  return resolveConflicts(rawDoses, anchors).sort((a, b) => a.time - b.time || a.medication.localeCompare(b.medication));
}

function resolveConflicts(doses, anchors) {
  const next = doses.map((dose) => ({ ...dose }));
  const sucralfateMorning = next.find((dose) => dose.medication === "SUCRAFILM" && dose.label === "D1");
  const sucralfateNight = next.find((dose) => dose.medication === "SUCRAFILM" && dose.label === "D2");
  const zolpidem = next.find((dose) => dose.medication === "ZOLPIDEM");
  const losartanaBreakfast = next.find((dose) => dose.medication === "LOSARTANA" && dose.label === "D1");
  const calcio = next.find((dose) => dose.medication === "CÁLCIO");

  if (sucralfateMorning && losartanaBreakfast && Math.abs(sucralfateMorning.time - losartanaBreakfast.time) <= 420) {
    sucralfateMorning.time = anchors.lunch + 120;
    sucralfateMorning.status = "SHIFTED";
    sucralfateMorning.reason = "Deslocado para almoço + 2h por conflito com LOSARTANA.";
  }

  if (sucralfateNight && zolpidem && sucralfateNight.time === zolpidem.time) {
    sucralfateNight.status = "INACTIVE";
    sucralfateNight.reason = "Dose inativada por conflito obrigatório com ZOLPIDEM.";
  }

  if (calcio && next.some((dose) => dose.medication === "SUCRAFILM" && dose.time === calcio.time)) {
    calcio.time += 60;
    calcio.status = "SHIFTED";
    calcio.reason = "Dose deslocada +60min por janela clínica.";
  }

  return next;
}

function render() {
  elements.screenTitle.textContent = stepTitles[state.currentStep];
  elements.flowSteps.forEach((step) => step.classList.toggle("active", step.dataset.step === state.currentStep));
  elements.screens.forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === state.currentStep));

  const patient = readPatient();
  elements.auditPatient.textContent = state.patientSaved ? patient.name : "Pendente";
  elements.auditRoutine.textContent = state.routineSaved ? "Ativa" : "Pendente";
  elements.auditSchedule.textContent = state.schedule.length ? `${state.schedule.length} doses` : "Não gerada";

  setStatus(elements.patientStatus, state.patientSaved ? "Salvo" : "Pendente", state.patientSaved ? "ready" : "pending");
  setStatus(elements.routineStatus, state.routineSaved ? "Ativa" : "Pendente", state.routineSaved ? "ready" : "pending");
  setStatus(
    elements.prescriptionStatus,
    state.prescriptionSaved ? "Agenda gerada" : "Em edição",
    state.prescriptionSaved ? "ready" : "pending",
  );

  renderTimeline();
  renderMedicationList();
  renderCalendar();
  refreshIcons();
}

function setStatus(element, text, tone) {
  element.textContent = text;
  element.className = `status-pill ${tone}`;
}

function renderTimeline() {
  const labels = [
    ["wake", "Acordar"],
    ["breakfast", "Café"],
    ["lunch", "Almoço"],
    ["snack", "Lanche"],
    ["dinner", "Jantar"],
    ["sleep", "Dormir"],
    ["bath", "Banho"],
  ];
  const routine = readRoutine();
  const max = 24 * 60;
  elements.routineTimeline.innerHTML = labels
    .map(([key, label]) => {
      const minutes = toMinutes(routine[key]);
      const width = Math.max(2, (minutes / max) * 100);
      return `
        <div class="timeline-item">
          <strong>${label}</strong>
          <div class="timeline-track"><div class="timeline-fill" style="width:${width}%"></div></div>
          <span>${routine[key]}</span>
        </div>
      `;
    })
    .join("");
}

function renderMedicationList() {
  elements.medicationList.innerHTML = selectedMedications()
    .map((medication) => `
      <article class="medication-card">
        <header>
          <div>
            <h3>${medication.name}</h3>
            <div class="medication-meta">${medication.principle} · ${medication.route} · ${medication.group}</div>
          </div>
          <strong>${medication.frequency}x</strong>
        </header>
        <div class="medication-rules">
          <span class="rule-tag">${medication.protocol}</span>
          ${medication.rules.map((rule) => `<span class="rule-tag">${rule}</span>`).join("")}
        </div>
      </article>
    `)
    .join("");
}

function renderCalendar() {
  const patient = readPatient();
  elements.calendarPatientName.textContent = patient.name;
  elements.dayStrip.innerHTML = ["17/04", "18/04", "19/04", "20/04", "21/04", "22/04"]
    .map((day, index) => `
      <div class="day-cell">
        <strong>${day}</strong>
        <span>${index === 0 ? "Início" : "Dia " + (index + 1)}</span>
      </div>
    `)
    .join("");

  if (!state.schedule.length) {
    elements.doseBoard.innerHTML = `<div class="detail-empty">Nenhuma dose gerada.</div>`;
    elements.doseDetails.innerHTML = `<div class="detail-empty">Selecione uma dose no calendário.</div>`;
    return;
  }

  elements.doseBoard.innerHTML = state.schedule
    .map((dose) => {
      const tone = dose.manual ? "manual" : dose.status === "INACTIVE" ? "inactive" : dose.status === "SHIFTED" ? "warning" : "";
      const statusLabel = dose.manual ? "Manual" : dose.status === "INACTIVE" ? "Inativa" : dose.status === "SHIFTED" ? "Deslocada" : "Ativa";
      return `
        <article class="dose-row ${tone}" data-dose-id="${dose.id}">
          <div class="dose-time">${toTime(dose.time)}</div>
          <div>
            <div class="dose-name">${dose.medication} · ${dose.label}</div>
            <div class="dose-meta">${dose.protocol} · ${statusLabel}</div>
          </div>
          <div class="dose-actions">
            <button class="mini-button" type="button" data-adjust="${dose.id}">
              <i data-lucide="clock"></i>
              Ajustar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  const selected = state.schedule.find((dose) => dose.id === state.selectedDoseId) || state.schedule[0];
  state.selectedDoseId = selected.id;
  renderDoseDetails(selected);
}

function renderDoseDetails(dose) {
  elements.doseDetails.innerHTML = `
    <div class="detail-block">
      <span>Medicamento</span>
      <strong>${dose.medication}</strong>
      <small>${dose.principle}</small>
    </div>
    <div class="detail-block">
      <span>Horário</span>
      <strong>${toTime(dose.time)}</strong>
      <small>Original: ${toTime(dose.originalTime)} · ${anchorLabel(dose.anchor)} ${formatOffset(dose.offset)}</small>
    </div>
    <div class="detail-block">
      <span>Status</span>
      <strong>${dose.manual ? "Manual" : dose.status}</strong>
      <small>${dose.reason}</small>
    </div>
    <div class="detail-block">
      <span>Recorrência</span>
      <strong>${dose.recurrence}</strong>
      <small>${dose.route} · ${dose.group}</small>
    </div>
  `;
}

function anchorLabel(anchor) {
  return {
    wake: "ACORDAR",
    breakfast: "CAFÉ",
    lunch: "ALMOÇO",
    snack: "LANCHE",
    dinner: "JANTAR",
    sleep: "DORMIR",
    bath: "APÓS BANHO",
  }[anchor];
}

function formatOffset(offset) {
  if (offset === 0) return "+ 0min";
  return offset > 0 ? `+ ${offset}min` : `- ${Math.abs(offset)}min`;
}

function changeStep(step) {
  state.currentStep = step;
  render();
}

function generateSchedule() {
  state.prescriptionSaved = true;
  state.schedule = buildSchedule();
  state.selectedDoseId = state.schedule[0]?.id || null;
  changeStep("calendar");
}

function openManualDialog(doseId) {
  const dose = state.schedule.find((item) => item.id === doseId);
  if (!dose) return;
  state.manualTargetId = doseId;
  elements.manualSummary.innerHTML = `<strong>${dose.medication} · ${dose.label}</strong><br>Horário atual: ${toTime(dose.time)} · Horário original: ${toTime(dose.originalTime)}`;
  elements.manualTimeInput.value = toTime(dose.time) === "24:00" ? "23:59" : toTime(dose.time);
  elements.manualDialog.showModal();
  refreshIcons();
}

function applyManualAdjust() {
  const dose = state.schedule.find((item) => item.id === state.manualTargetId);
  if (!dose) return;
  dose.time = toMinutes(elements.manualTimeInput.value);
  dose.status = "ACTIVE";
  dose.manual = true;
  dose.reason = elements.manualReason.value;
  state.schedule.sort((a, b) => a.time - b.time || a.medication.localeCompare(b.medication));
  state.selectedDoseId = dose.id;
  elements.manualDialog.close();
  render();
}

function resetDemo() {
  state = {
    currentStep: "patient",
    selectedPreset: "baseline",
    patientSaved: false,
    routineSaved: false,
    prescriptionSaved: false,
    selectedDoseId: null,
    manualTargetId: null,
    schedule: [],
  };
  document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.preset === "baseline"));
  render();
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

document.addEventListener("click", (event) => {
  const nextButton = event.target.closest("[data-next]");
  if (nextButton) {
    if (state.currentStep === "patient") state.patientSaved = true;
    if (state.currentStep === "routine") state.routineSaved = true;
    changeStep(nextButton.dataset.next);
    return;
  }

  const stepButton = event.target.closest(".flow-step");
  if (stepButton) {
    changeStep(stepButton.dataset.step);
    return;
  }

  const presetButton = event.target.closest("[data-preset]");
  if (presetButton) {
    state.selectedPreset = presetButton.dataset.preset;
    state.prescriptionSaved = false;
    state.schedule = [];
    document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip === presetButton));
    render();
    return;
  }

  const adjustButton = event.target.closest("[data-adjust]");
  if (adjustButton) {
    openManualDialog(adjustButton.dataset.adjust);
    return;
  }

  const doseRow = event.target.closest("[data-dose-id]");
  if (doseRow) {
    state.selectedDoseId = doseRow.dataset.doseId;
    const dose = state.schedule.find((item) => item.id === state.selectedDoseId);
    if (dose) renderDoseDetails(dose);
  }
});

document.querySelector("#generateSchedule").addEventListener("click", generateSchedule);
document.querySelector("#backToPrescription").addEventListener("click", () => changeStep("prescription"));
document.querySelector("#confirmManualAdjust").addEventListener("click", applyManualAdjust);
document.querySelector("#resetDemo").addEventListener("click", resetDemo);

["wakeTime", "breakfastTime", "lunchTime", "snackTime", "dinnerTime", "sleepTime", "bathTime"].forEach((id) => {
  document.querySelector(`#${id}`).addEventListener("input", () => {
    state.routineSaved = false;
    state.schedule = [];
    render();
  });
});

render();
