import { GmailClientService } from './gmail-client.service';

describe('paginación sin saltar correos de Gmail', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retiene el cursor al alcanzar el tope y avanza tras guardar los pendientes', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      historyId: '900', history: [{ messagesAdded: ['a', 'b', 'c'].map(id => ({ message: { id } })) }],
    }), { status: 200 }));
    const service = new GmailClientService();
    const first = await service.listHistory('fixture-token', '100', 2);
    expect(first).toEqual({ messageIds: ['a', 'b'], historyId: '100' });
    const saved = new Set(first.messageIds);
    const next = await service.listHistory('fixture-token', first.historyId!, 2, async id => saved.has(id));
    expect(next).toEqual({ messageIds: ['c'], historyId: '900' });
  });

  it('lee páginas posteriores aunque la primera contenga solo mensajes ya guardados', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'a' }], nextPageToken: 'pagina2' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'b' }, { id: 'c' }] })));
    const result = await new GmailClientService().listRecentMessages('fixture-token', 'after:1', 1, async id => id === 'a');
    expect(result).toEqual({ messageIds: ['b'], complete: false });
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=pagina2');
  });
});
