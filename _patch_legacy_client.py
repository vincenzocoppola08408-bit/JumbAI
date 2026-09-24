from pathlib import Path
p = Path('pages/index.tsx')
s = p.read_text(encoding='utf-8')
orig = s

helper = '''
// Legacy DB video_generati (id, user_id, url_video, prompt_usato, creato_il): derive UI fields
function normalizzaVideo(r: any): Video {
  const url: string | null = r?.url_video ?? null;
  let stato: StatoVideo = r?.stato;
  if (!stato) {
    if (url && String(url).startsWith('http')) stato = 'completato';
    else if (url === 'failed' || url === 'fallito') stato = 'fallito';
    else stato = 'rendering';
  }
  const prompt = r?.prompt ?? r?.prompt_usato ?? '';
  return {
    ...r,
    prompt,
    titolo: r?.titolo ?? String(prompt).substring(0, 60),
    stato,
    url_video: url && String(url).startsWith('http') ? url : (stato === 'completato' ? url : null),
  } as Video;
}

export default function Home() {'''
assert s.count('\nexport default function Home() {') == 1
s = s.replace('\nexport default function Home() {', helper, 1)

old_rt = '''          const nuovo = payload.new as any;
          if (!nuovo) return;'''
new_rt = '''          const raw = payload.new as any;
          if (!raw || !raw.id) return;
          const nuovo = normalizzaVideo(raw);'''
assert s.count(old_rt) == 1
s = s.replace(old_rt, new_rt, 1)
s = s.replace('copy[idx] = { ...copy[idx], ...nuovo };', 'copy[idx] = normalizzaVideo({ ...copy[idx], ...raw });', 1)
s = s.replace('return [nuovo as Video, ...prev];', 'return [nuovo, ...prev];', 1)

old_load = 'if (data) setVideos(data as Video[]);'
assert s.count(old_load) == 1
s = s.replace(old_load, 'if (data) setVideos((data as any[]).map(normalizzaVideo));', 1)

# BYOK insert -> legacy columns
start = s.index("      const { data: inserted, error: insertErr } = await supabase\n        .from('video_generati')\n        .insert({")
end = s.index("        .select('id')", start)
new_ins = """      const { data: inserted, error: insertErr } = await supabase
        .from('video_generati')
        .insert({
          user_id: session.user.id,
          prompt_usato: prompt.trim(),
          url_video: videoUri,
        })
"""
s = s[:start] + new_ins + s[end:]
assert s != orig
p.write_text(s, encoding='utf-8')
print('patched')
