import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { userId } = await req.json() || {};

  if (!userId) {
    return NextResponse.json({ error: 'userId mancante' }, { status: 400 });
  }

  try {
    const { data: newImages } = await supabaseAdmin
      .from('immagini_generate')
      .select('*')
      .eq('user_id', userId)
      .order('creato_il', { ascending: true });

    return NextResponse.json({
      synced_at: new Date().toISOString(),
      total: newImages?.length || 0,
      pending_sync: (newImages || []).length,
      missing_files: [],
      next_sync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gallery sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}