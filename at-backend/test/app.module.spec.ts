import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { buildTypeOrmOptions } from "../src/app.module";
import { buildCalendarDocumentHeaderConfig } from "../src/modules/scheduling/config/calendar-document-header.config";

describe("buildTypeOrmOptions", () => {
  it("fails fast when DB_SYNC is enabled in production", () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === "NODE_ENV") return "production";
        if (key === "DB_SYNC") return "true";
        return defaultValue;
      }),
    } as unknown as ConfigService;

    expect(() => buildTypeOrmOptions(configService)).toThrow(
      "DB_SYNC não pode ser habilitado em produção; use migrations.",
    );
  });

  it("fails fast when calendar document header config is missing", () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "CALENDAR_COMPANY_NAME") return "AT Farma";
        return undefined;
      }),
    } as unknown as ConfigService;

    expect(() => buildCalendarDocumentHeaderConfig(configService)).toThrow(
      "Configuração obrigatória ausente para calendário posológico: CALENDAR_COMPANY_CNPJ (cnpj).",
    );
  });
});
