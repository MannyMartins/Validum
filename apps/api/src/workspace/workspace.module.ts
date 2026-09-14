import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
@Module({ imports: [DocumentsModule], controllers: [WorkspaceController], providers: [WorkspaceService] })
export class WorkspaceModule {}
