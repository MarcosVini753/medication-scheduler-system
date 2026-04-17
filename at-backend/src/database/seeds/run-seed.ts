import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { MedicationService } from '../../modules/medications/medication.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const medicationService = app.get(MedicationService);
  await medicationService.createDefaultGroups();
  await app.close();
  console.log('Grupos padrão carregados com sucesso.');
}

run();
