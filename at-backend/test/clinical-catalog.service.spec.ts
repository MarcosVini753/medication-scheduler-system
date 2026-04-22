import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { ClinicalCatalogService } from '../src/modules/clinical-catalog/clinical-catalog.service';

describe('ClinicalCatalogService', () => {
  function createService() {
    const medicationRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    const groupRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
    };

    return {
      service: new ClinicalCatalogService(
        medicationRepository as never,
        groupRepository as never,
      ),
      medicationRepository,
      groupRepository,
    };
  }

  it('creates a clinical medication with protocols, frequencies and interaction rules', async () => {
    const { service, groupRepository, medicationRepository } = createService();
    groupRepository.find.mockResolvedValue([
      { id: 'group-i', code: GroupCode.GROUP_I, name: 'Grupo I' },
    ]);

    const result = await service.createMedication({
      commercialName: 'LOSARTANA',
      activePrinciple: 'Losartana potassica',
      presentation: 'Comprimido revestido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      protocols: [
        {
          code: 'GROUP_I_STANDARD',
          name: 'Grupo I padrao',
          description: 'Protocolo simples.',
          groupCode: GroupCode.GROUP_I,
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                },
              ],
            },
          ],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
              priority: 1,
            },
          ],
        },
      ],
    });

    expect(medicationRepository.create).toHaveBeenCalled();
    expect(medicationRepository.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      commercialName: 'LOSARTANA',
      protocols: [
        {
          code: 'GROUP_I_STANDARD',
          group: { code: GroupCode.GROUP_I },
          frequencies: [
            {
              frequency: 1,
              steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 }],
            },
          ],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            },
          ],
        },
      ],
    });
  });

  it('rejects protocol creation when the referenced clinical group does not exist', async () => {
    const { service, groupRepository } = createService();
    groupRepository.find.mockResolvedValue([]);

    await expect(
      service.createMedication({
        activePrinciple: 'Teste',
        presentation: 'Caixa',
        administrationRoute: 'VO',
        usageInstructions: 'Conforme prescricao.',
        protocols: [
          {
            code: 'PROTO',
            name: 'Protocolo',
            description: 'Descricao',
            groupCode: GroupCode.GROUP_I,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seeds the default clinical groups without depending on the legacy module', async () => {
    const { service, groupRepository, medicationRepository } = createService();
    const allGroups = [
      GroupCode.GROUP_I,
      GroupCode.GROUP_II,
      GroupCode.GROUP_II_BIFOS,
      GroupCode.GROUP_II_SUCRA,
      GroupCode.GROUP_III,
      GroupCode.GROUP_III_MET,
      GroupCode.GROUP_III_SAL,
      GroupCode.GROUP_III_CALC,
      GroupCode.GROUP_I_SED,
      GroupCode.GROUP_DELTA,
    ].map((code) => ({ id: `${code}-id`, code }));

    groupRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(allGroups);
    medicationRepository.find.mockResolvedValue([]);

    await service.seedCatalog();

    expect(groupRepository.save).toHaveBeenCalled();
    expect(medicationRepository.save).toHaveBeenCalled();
    const savedGroups = groupRepository.save.mock.calls[0][0];
    expect(Array.isArray(savedGroups)).toBe(true);
    expect(savedGroups.length).toBeGreaterThan(0);
    expect(savedGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: GroupCode.GROUP_I }),
        expect.objectContaining({ code: GroupCode.GROUP_III_SAL }),
        expect.objectContaining({ code: GroupCode.GROUP_DELTA }),
      ]),
    );

    const savedMedicationCalls = medicationRepository.save.mock.calls;
    const flattenedSavedMedications = savedMedicationCalls.flatMap((call) =>
      Array.isArray(call[0]) ? call[0] : [call[0]],
    );

    expect(flattenedSavedMedications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commercialName: 'LOSARTANA',
          protocols: expect.arrayContaining([
            expect.objectContaining({
              code: 'GROUP_I_STANDARD',
              frequencies: expect.arrayContaining([
                expect.objectContaining({ frequency: 1 }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'METRONIDAZOL',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_METRONIDAZOL_VAGINAL' }),
          ]),
        }),
      ]),
    );
  });
});
