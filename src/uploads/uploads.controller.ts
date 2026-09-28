import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadDocType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UploadFileDto } from './dto/upload-file.dto';
import { UploadsService } from './uploads.service';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('jobs/:id/uploads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @RequirePermission('UPLOADS', 'write')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  @ApiOperation({
    summary:
      'Upload one of the 6 source file types for a Job (multipart, field name "file")',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'docType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string', enum: Object.values(UploadDocType) },
        date: { type: 'string', example: '2026-07-08' },
      },
    },
  })
  upload(
    @Param('id') jobId: string,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.uploadsService.upload(
      jobId,
      dto,
      file,
      user.userId,
      user.orgId,
    );
  }

  @Get()
  @RequirePermission('UPLOADS', 'read')
  @ApiOperation({ summary: "List a Job's uploaded documents" })
  findAll(@Param('id') jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.uploadsService.findAll(jobId, user.orgId);
  }
}
