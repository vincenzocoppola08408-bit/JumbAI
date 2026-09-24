from pathlib import Path
p = Path('pages/api/genera-premium.js')
s = p.read_text(encoding='utf-8')
old = "      return res.status(502).json({ error: 'Impossibile inviare la richiesta a Fal.ai.' });"
assert s.count(old) == 1
new = """      const falDetail = falData
        ? (falData.detail || falData.message || falData.error || falData)
        : null;
      return res.status(502).json({
        error: 'Impossibile inviare la richiesta a Fal.ai.',
        falStatus: falRes.status,
        falEndpoint,
        falKeyPresent: Boolean(process.env.FAL_AI_MASTER_KEY),
        falDetail: typeof falDetail === 'string' ? falDetail.slice(0, 800) : JSON.stringify(falDetail || '').slice(0, 800),
      });"""
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('ok')
