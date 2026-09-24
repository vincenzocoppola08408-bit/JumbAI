from pathlib import Path

path = Path("pages/api/genera-premium.js")
text = path.read_text(encoding="utf-8")

old_insert_block = """    // 3. Crea record \"rendering\" nel DB (id è generato da Supabase)
    const { data: nuovoVideo, error: insertError } = await supabaseAdmin
      .from('video_generati')
      .insert({
        user_id: userId,
        prompt: prompt,
        prompt_negativo: prompt_negativo,
        seed: seed || null,
        modello: modello,
        tipo_input: tipo_input,
        durata_secondi: durata_secondi,
        risoluzione: risoluzione,
        genera_audio: genera_audio,
        ottimizza_prompt: ottimizza_prompt,
        titolo: prompt.substring(0, 60),
        stato: 'rendering',
      })
      .select('id')
      .single();

    if (insertError || !nuovoVideo) {
      // Rollback crediti
      await supabaseAdmin
        .from('profili')
        .update({ crediti: utente.crediti })
        .eq('id', userId);
      return res.status(500).json({ error: 'Errore creazione record video.' });
    }"""

new_insert_block = """    // 3. Crea record nel DB (LIVE schema: id, user_id, url_video, prompt_usato, creato_il)
    // schema-v2 columns (prompt/stato/titolo/...) are NOT on production yet.
    // url_video is NOT NULL on legacy schema -> placeholder until webhook fills the real URL.
    const { data: nuovoVideo, error: insertError } = await supabaseAdmin
      .from('video_generati')
      .insert({
        user_id: userId,
        prompt_usato: prompt,
        url_video: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !nuovoVideo) {
      // Rollback crediti
      await supabaseAdmin
        .from('profili')
        .update({ crediti: utente.crediti })
        .eq('id', userId);
      console.error('video_generati insert error:', insertError);
      return res.status(500).json({
        error: 'Errore creazione record video.',
        insertError: insertError
          ? { message: insertError.message, code: insertError.code, details: insertError.details, hint: insertError.hint }
          : { message: 'insert returned no row' },
      });
    }"""

if old_insert_block not in text:
    raise SystemExit('INSERT_BLOCK_NOT_FOUND')
text = text.replace(old_insert_block, new_insert_block)

old_msg = "error: `Crediti insufficienti. Servono \\ crediti, ne hai ${utente.crediti}.`,"
new_msg = "error: `Crediti insufficienti. Servono ${costoCrediti} crediti, ne hai ${utente.crediti}.`,"
if old_msg in text:
    text = text.replace(old_msg, new_msg)
    print('fixed cost message')
elif 'Servono ${costoCrediti} crediti' in text:
    print('cost message already ok')
else:
    print('WARN cost message pattern not found')
    for i, line in enumerate(text.splitlines(), 1):
        if 'Crediti insufficienti' in line:
            print(i, repr(line))

old_fal_fail = """    if (!falRes.ok) {
      // Rollback: ripristina credito e segna come fallito
      await supabaseAdmin
        .from('profili')
        .update({ crediti: utente.crediti })
        .eq('id', userId);

      await supabaseAdmin
        .from('video_generati')
        .update({ stato: 'fallito', errore: `Fal.ai error: ${falRes.status}` })
        .eq('id', videoId);

      console.error('Fal.ai error:', falRes.status, falData);
      return res.status(502).json({ error: 'Impossibile inviare la richiesta a Fal.ai.' });
    }

    // 8. Salva request_id per tracciamento
    const requestId = falData?.request_id || null;
    if (requestId) {
      await supabaseAdmin
        .from('video_generati')
        .update({ request_id: requestId })
        .eq('id', videoId);
    }"""

new_fal_fail = """    if (!falRes.ok) {
      // Rollback: ripristina crediti e rimuovi record pending (legacy schema has no stato/errore)
      await supabaseAdmin
        .from('profili')
        .update({ crediti: utente.crediti })
        .eq('id', userId);

      await supabaseAdmin
        .from('video_generati')
        .delete()
        .eq('id', videoId);

      console.error('Fal.ai error:', falRes.status, falData);
      return res.status(502).json({ error: 'Impossibile inviare la richiesta a Fal.ai.' });
    }

    // 8. request_id: column absent on legacy live schema — keep in response only
    const requestId = falData?.request_id || null;"""

if old_fal_fail not in text:
    raise SystemExit('FAL_FAIL_BLOCK_NOT_FOUND')
text = text.replace(old_fal_fail, new_fal_fail)

path.write_text(text, encoding='utf-8')
print('updated', path)
print('has prompt_usato', 'prompt_usato' in text)
print('has insertError.message', 'insertError.message' in text)
print('has pending placeholder', "url_video: 'pending'" in text)
