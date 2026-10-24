import { createClaudeTutor } from '../../src/api/tutor.js';

/** A Claude tutor wired to a scripted model reply and a fake note, recording every request. */
export function createRetrievalTutorStub(reply) {
  const calls = [];
  const call = async (req) => { calls.push(req); return { text: reply }; };
  const tutor = createClaudeTutor({ personaId: 'chen', call, readNote: async () => '# T\n## H\nThe postal rule: acceptance is effective on posting.', listFiles: async () => [] });
  return { tutor, calls };
}
