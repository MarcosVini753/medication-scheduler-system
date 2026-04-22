import 'reflect-metadata';
import { Repository } from 'typeorm';
import { DoseUnit } from '../../src/common/enums/dose-unit.enum';
import { GroupCode } from '../../src/common/enums/group-code.enum';
import { ScheduleStatus } from '../../src/common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../../src/common/enums/treatment-recurrence.enum';
import { MedicationCatalog } from '../../src/modules/medications/entities/medication-catalog.entity';
import { MedicationGroup } from '../../src/modules/medications/entities/medication-group.entity';
import { PrescriptionItem } from '../../src/modules/prescriptions/entities/prescription-item.entity';
import { Prescription } from '../../src/modules/prescriptions/entities/prescription.entity';
import {
  ScheduleEntryDto,
  SchedulingResultDto,
} from '../../src/modules/scheduling/dto/schedule-response.dto';
import { ScheduledDose } from '../../src/modules/scheduling/entities/scheduled-dose.entity';
import { SchedulingService } from '../../src/modules/scheduling/scheduling.service';
import { SchedulingRulesService } from '../../src/modules/scheduling/services/scheduling-rules.service';

export interface RoutineFixture {
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
}

interface CreateServiceOptions {
  routine?: RoutineFixture;
}

const DEFAULT_ROUTINE: RoutineFixture = {
  acordar: '06:00',
  cafe: '07:00',
  almoco: '12:00',
  lanche: '15:00',
  jantar: '19:00',
  dormir: '22:00',
};

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function buildRoutine(
  overrides: Partial<RoutineFixture> = {},
): RoutineFixture {
  return {
    ...DEFAULT_ROUTINE,
    ...overrides,
  };
}

export function createSchedulingService(
  options: CreateServiceOptions = {},
): {
  service: SchedulingService;
  scheduledDoseRepository: jest.Mocked<Repository<ScheduledDose>>;
} {
  const scheduledDoseRepository = {
    create: jest.fn((entity) => entity as ScheduledDose),
    delete: jest.fn().mockResolvedValue({ affected: 0 } as never),
    find: jest.fn(),
    save: jest.fn(async (entities: ScheduledDose[]) =>
      entities.map((entity, index) => ({
        ...entity,
        id: `scheduled-dose-${index + 1}`,
      })),
    ),
  } as unknown as jest.Mocked<Repository<ScheduledDose>>;

  const prescriptionRepository = {
    findOne: jest.fn(),
  } as unknown as jest.Mocked<Repository<Prescription>>;

  const patientService = {
    getActiveRoutine: jest
      .fn()
      .mockResolvedValue(options.routine ?? buildRoutine()),
  };

  const service = new SchedulingService(
    scheduledDoseRepository,
    prescriptionRepository,
    patientService as never,
    new SchedulingRulesService(),
  );

  return { service, scheduledDoseRepository };
}

export function buildGroup(
  overrides: Partial<MedicationGroup> = {},
): MedicationGroup {
  return {
    id: nextId('group'),
    code: GroupCode.GROUP_I,
    name: 'Grupo I',
    description: 'Grupo de teste',
    medications: [],
    ...overrides,
  };
}

export function buildMedication(
  group: MedicationGroup,
  overrides: Partial<MedicationCatalog> = {},
): MedicationCatalog {
  return {
    id: nextId('medication'),
    commercialName: 'Medicamento Teste',
    activePrinciple: 'Principio ativo',
    presentation: 'Caixa',
    administrationRoute: 'ORAL',
    usageInstructions: 'Conforme prescricao',
    interferesWithSalts: false,
    group,
    ...overrides,
  };
}

type ItemOverrides = Omit<Partial<PrescriptionItem>, 'medication'> & {
  medication?: Partial<MedicationCatalog>;
  group?: Partial<MedicationGroup>;
};

export function buildItem(overrides: ItemOverrides = {}): PrescriptionItem {
  const { medication: medicationOverrides, group: groupOverrides, ...itemOverrides } =
    overrides;
  const group = buildGroup(groupOverrides);
  const medication = buildMedication(group, medicationOverrides);

  return {
    id: nextId('item'),
    frequency: 1,
    doseAmount: '1 COMP',
    recurrenceType: TreatmentRecurrence.DAILY,
    doseValue: '1',
    doseUnit: DoseUnit.COMP,
    sameDosePerSchedule: true,
    perDoseOverrides: undefined,
    dailyTreatment: true,
    alternateDaysInterval: undefined,
    weeklyDay: undefined,
    monthlyRule: undefined,
    monthlyDay: undefined,
    treatmentDays: 10,
    continuousUse: false,
    prnReason: undefined,
    crisisOnly: false,
    feverOnly: false,
    painOnly: false,
    manualAdjustmentEnabled: false,
    manualTimes: undefined,
    schedules: [],
    medication,
    ...itemOverrides,
  } as PrescriptionItem;
}

export function buildPrescription(
  items: PrescriptionItem[],
  overrides: Partial<Prescription> = {},
): Prescription {
  return {
    id: nextId('prescription'),
    startedAt: '2026-04-17',
    patient: {
      id: nextId('patient'),
      fullName: 'Paciente Teste',
      birthDate: '1970-01-01',
      rg: 'RG-TESTE',
      cpf: '000.000.000-00',
      phone: '(68) 99999-9999',
      routines: [],
      prescriptions: [],
    },
    status: 'ACTIVE',
    items: items.map((item) => ({
      ...item,
      prescription: undefined as unknown as Prescription,
    })),
    ...overrides,
  } as Prescription;
}

export async function buildScheduleResult(
  service: SchedulingService,
  items: PrescriptionItem[],
  overrides: Partial<Prescription> = {},
): Promise<SchedulingResultDto> {
  return service.buildAndPersistSchedule(buildPrescription(items, overrides));
}

export function expectEntry(
  entry: ScheduleEntryDto | undefined,
  expectation: Partial<ScheduleEntryDto>,
): void {
  expect(entry).toBeDefined();
  expect(entry).toMatchObject({
    status: ScheduleStatus.ACTIVE,
    ...expectation,
  });
}

export function expectInactiveEntry(
  entry: ScheduleEntryDto | undefined,
  expectation: Partial<ScheduleEntryDto>,
): void {
  expect(entry).toBeDefined();
  expect(entry).toMatchObject({
    status: ScheduleStatus.INACTIVE,
    ...expectation,
  });
}

export function findEntryByTime(
  result: SchedulingResultDto,
  medicationName: string,
  timeFormatted: string,
): ScheduleEntryDto | undefined {
  return result.entries.find(
    (entry) =>
      entry.medicationName === medicationName &&
      entry.timeFormatted === timeFormatted,
  );
}
