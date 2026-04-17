import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientModule } from './modules/patients/patient.module';
import { MedicationModule } from './modules/medications/medication.module';
import { PrescriptionModule } from './modules/prescriptions/prescription.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('DB_SYNC', 'false') === 'true',
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true'
      })
    }),
    PatientModule,
    MedicationModule,
    PrescriptionModule,
    SchedulingModule
  ]
})
export class AppModule {}
