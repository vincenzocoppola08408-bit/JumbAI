import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  try {
    const payload = req.body || {};
    const requestId = payload.request_id;
    const videoUrl = payload?.payload?.video?.url || payload?.video?.url;
    const userId = payload?.payload?.user_data?.userId || payload?.user_data?.userId;
    const prompt = payload?.payload?.user_data?.promptUsato || payload?.user_data?.promptUsato;

    // Fal.ai invia anche richieste di errore; il nostro payload finale contiene video.url
    if (!videoUrl || !userId) {
      return res.status(200).json({ status: 'ok', received: false, request_id: requestId });
    }

    // Idempotenza: evita doppi inserimenti se Fal.ai ritenta il webhook
    const { data: existing, error: checkError } = await supabase
      .from('video_generati')
      .select('id')
      .eq('url_video', videoUrl)
      .limit(1);

    if (checkError) {
      console.error('Controllo idempotenza:', checkError);
      return res.status(500).json({ error: 'Errore controllo idempotenza.' });
    }
    if (existing && existing.length > 0) {
      return res.status(200).json({ status: 'success', duplicate: true, request_id: requestId });
    }

    const { error: dbError } = await supabase
      .from('video_generati')
      .insert([{ user_id: userId, url_video: videoUrl, prompt_usato: prompt || '' }]);

    if (dbError) {
      console.error('Errore scrittura DB:', dbError);
      return res.status(500).json({ error: 'Errore salvataggio video.' });
    }

    return res.status(200).json({ status: 'success', request_id: requestId });

  } catch (e) {
    console.error('Errore webhook video:', e);
    return res.status(500).json({ error: 'Errore interno del webhook.' });
  }
}
