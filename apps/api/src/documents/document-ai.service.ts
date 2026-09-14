import { Injectable } from '@nestjs/common';
export type ExtractionResult = { text: string; confidence: number; fields: Record<string, string | number | null> };
export interface DocumentAiProvider { extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult>; }
class MockDocumentAiProvider implements DocumentAiProvider {
  async extract(): Promise<ExtractionResult> { return { text: '', confidence: 0, fields: {} }; }
}
/** Provider seam: add OpenAI, Google Vision, Azure DI, or a private OCR adapter here. */
@Injectable()
export class DocumentAiService {
  private provider: DocumentAiProvider = new MockDocumentAiProvider();
  extract(buffer: Buffer, mimeType: string) { return this.provider.extract(buffer, mimeType); }
}
