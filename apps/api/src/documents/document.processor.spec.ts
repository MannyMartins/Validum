import { DocumentProcessor } from './document.processor';

describe('DocumentProcessor', () => {
  const document = {
    id: 'document-1',
    storageKey: 'tenant/cases/document.pdf',
    contentType: 'application/pdf',
  };

  it('extracts the actual file stored in S3', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      document: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(document),
        update,
      },
    };
    const body = Buffer.from('%PDF-real-content');
    const storage = { get: jest.fn().mockResolvedValue({ body, contentType: 'application/pdf' }) };
    const ai = { extract: jest.fn().mockResolvedValue({ text: 'contenido', confidence: 0.9, fields: {} }) };
    const processor = new DocumentProcessor(prisma as never, ai as never, storage as never);

    await processor.process({ data: { documentId: document.id } } as never);

    expect(storage.get).toHaveBeenCalledWith(document.storageKey);
    expect(ai.extract).toHaveBeenCalledWith(body, 'application/pdf');
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PROCESSED', extractedText: 'contenido' }),
    }));
  });

  it('marks a document as failed when storage or extraction fails', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      document: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(document),
        update,
      },
    };
    const storageError = new Error('storage unavailable');
    const storage = { get: jest.fn().mockRejectedValue(storageError) };
    const processor = new DocumentProcessor(prisma as never, { extract: jest.fn() } as never, storage as never);

    await expect(processor.process({ data: { documentId: document.id } } as never)).rejects.toBe(storageError);
    expect(update).toHaveBeenLastCalledWith({ where: { id: document.id }, data: { status: 'FAILED' } });
  });
});
