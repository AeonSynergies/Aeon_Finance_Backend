import { ConflictException } from '@nestjs/common';

export interface BlockingRow {
  id: string;
  validationStatus: string;
}

export class SubmitBlockedException extends ConflictException {
  constructor(blockingRows: BlockingRow[]) {
    super({
      message: `Cannot submit: ${blockingRows.length} row(s) are unresolved`,
      blockingRows,
    });
  }
}
