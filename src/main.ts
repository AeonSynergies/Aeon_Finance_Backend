import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aeon Finance Backend API')
    .setDescription('API for the Aeon Finance backend.')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('App', 'Root health-check route')
    .addTag('auth', 'Login and JWT issuance')
    .addTag('jobs', 'Payroll Jobs: create/list/lock, computed status')
    .addTag('uploads', 'Source file uploads (Payroll/Itinerary/Break Report)')
    .addTag('rows', 'Timecard row validation, listing, and overrides')
    .addTag('approvals', 'Per-date submit/approve/reject workflow')
    .addTag('audit', 'Audit trail for a Job')
    .addTag('settings', 'Engine thresholds')
    .addTag(
      'permissions',
      'Permission catalog (modules and Read / Write / Edit meanings)',
    )
    .addTag('team', 'Roles, role permissions and organization members')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
