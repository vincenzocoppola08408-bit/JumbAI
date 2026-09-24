from pathlib import Path
p = Path('pages/api/genera-premium.js')
s = p.read_text(encoding='utf-8')
a = s.index('    // 2. Scala crediti (optimistic lock)')
b = s.index('    // 4. Costruisci il payload per Fal.ai')
s = s[:a] + '''    // NOTE: niente addebito/record prima che Fal accetti -> nessuno storno visibile.

''' + s[b:]
s = s.replace('''        videoId: videoId,
''', '', 1)
s = s.replace("const webhookUrl = `${baseUrl}/api/webhook-video-pronto?videoId=${encodeURIComponent(videoId)}&userId=${encodeURIComponent(userId)}`;",
 "const webhookUrl = `${baseUrl}/api/webhook-video-pronto?userId=${encodeURIComponent(userId)}&prompt=${encodeURIComponent(String(prompt).slice(0, 300))}`;", 1)
a = s.index('    if (!falRes.ok) {')
b = s.index('    // 8. request_id')
s = s[:a] + '''    if (!falRes.ok) {
      // Nessun credito scalato e nessun record creato: niente da stornare.
      console.error('Fal.ai error:', falRes.status, falData);
      const falDetail = falData
        ? (falData.detail || falData.message || falData.error || falData)
        : null;
      return res.status(502).json({
        error: 'Impossibile inviare la richiesta a Fal.ai.',
        falStatus: falRes.status,
        falEndpoint,
        falKeyPresent: Boolean(process.env.FAL_AI_MASTER_KEY),
        falDetail: typeof falDetail === 'string' ? falDetail.slice(0, 800) : JSON.stringify(falDetail || '').slice(0, 800),
        crediti_rimasti: utente.crediti,
      });
    }

    // Fal ha accettato: ora consumo reale -> scala crediti e crea record "pending"
    const { error: updateError } = await supabaseAdmin
      .from('profili')
      .update({ crediti: utente.crediti - costoCrediti })
      .eq('id', userId)
      .eq('crediti', utente.crediti);
    if (updateError) console.error('Errore addebito crediti post-Fal:', updateError);

    const { data: nuovoVideo, error: insertError } = await supabaseAdmin
      .from('video_generati')
      .insert({ user_id: userId, prompt_usato: prompt, url_video: 'pending' })
      .select('id')
      .single();
    if (insertError) console.error('video_generati insert error (webhook inserira la riga):', insertError);
    const videoId = nuovoVideo?.id || null;

''' + s[b:]
p.write_text(s, encoding='utf-8')

w = Path('pages/api/webhook-video-pronto.js')
t = w.read_text(encoding='utf-8')
old = "    // Legacy fallback: insert completed row when videoId missing\n    if (userId && videoUrl) {"
assert old in t
new = """    // No videoId: aggiorna la riga pending piu vecchia dell'utente, altrimenti inserisci
    if (userId && videoUrl) {
      const { data: pending } = await supabaseAdmin
        .from('video_generati')
        .select('id')
        .eq('user_id', userId)
        .eq('url_video', 'pending')
        .order('creato_il', { ascending: true })
        .limit(1);
      if (pending && pending.length > 0) {
        const { error: upErr } = await supabaseAdmin
          .from('video_generati')
          .update({ url_video: videoUrl })
          .eq('id', pending[0].id);
        if (!upErr) return res.status(200).json({ status: 'success', video_id: pending[0].id, request_id: requestId });
        console.error('Update pending error:', upErr);
      }
    }
    if (userId && videoUrl) {"""
t = t.replace(old, new, 1)
t = t.replace("prompt_usato: userData.promptUsato || '',", "prompt_usato: userData.promptUsato || (typeof q.prompt === 'string' ? q.prompt : ''),", 1)
w.write_text(t, encoding='utf-8')
print('ok')
