// 会社版の通しテスト（複数人・役割・ドメイン・年間KPI・行動指標の記録が人ごと）
// 使い方: 空のローカルDBで npm run dev のあと  node tests/e2e/company.mjs
const B = process.env.BASE ?? 'http://127.0.0.1:8787';
function client() {
  let cookie = '';
  const req = async (method, path, body, expect) => {
    const r = await fetch(B + path, { method, redirect: 'manual', headers: { cookie, 'content-type': 'application/json', 'x-fj': '1' }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    if (expect != null) { if (r.status !== expect) throw new Error(`${method} ${path} expected ${expect} got ${r.status} ${t}`); return j; }
    if (r.status >= 400) throw new Error(`${method} ${path} ${r.status} ${t}`);
    return j;
  };
  return req;
}
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const boss = client();
await boss('GET', '/auth/dev');
const me = await boss('GET', '/api/me');
ok(me.user.email === 'isozaki@yusando.com' && me.member.role === 'owner', 'OWNER_EMAILS の人は代表で入る');

const staff = client();
await staff('GET', '/auth/dev?email=staff@yusando.com');
const sme = await staff('GET', '/api/me');
ok(sme.member.role === 'member', '@yusando.com の人は担当で入る');

const outsider = client();
await outsider('GET', '/auth/dev?email=someone@gmail.com', null, 403);
ok(true, '社外のアカウントは入れない');

// 共有のターム・目標
const term = await boss('GET', '/api/terms/current');
const sterm = await staff('GET', '/api/terms/current');
ok(term.id === sterm.id, '全員が同じ会社のタームを見る');
const g = await boss('POST', `/api/terms/${term.id}/goals`, { type: 'project', title: 'EC売上を四半期で1,500万円', metric_unit: '万円', metric_start: 0, metric_target: 1500 });
await staff('POST', `/api/terms/${term.id}/goals`, { type: 'project', title: '担当は作れない' }, 403);
ok(true, '担当は会社の目標を作れない');
const sdetail = await staff('GET', `/api/terms/${term.id}`);
ok(sdetail.goals.some((x) => x.id === g.id), '担当にも会社の目標が見える');

// 部署と役割
const dep = await boss('POST', '/api/org/departments', { name: 'EC' });
await boss('PATCH', `/api/org/departments/${dep.id}`, { lead_user_id: sme.user.id });
const org = await boss('GET', '/api/org');
const s2 = org.members.find((m) => m.id === sme.user.id);
ok(s2.role === 'lead' && s2.department_id === dep.id, '部署長にすると役割と所属が変わる');
ok(!org.members.some((m) => m.email.endsWith('.invalid')), '一覧に「会社」は出ない');
await staff('POST', '/api/org/departments', { name: '勝手な部署' }, 403);
ok(true, '部署を作れるのは代表だけ');
const g2 = await staff('POST', `/api/terms/${term.id}/goals`, { type: 'project', title: '定期便の会員を+300人', owner_type: 'department', department_id: dep.id, parent_goal_id: g.id });
ok(g2.owner_type === 'department' && g2.department_id === dep.id && g2.parent_goal_id === g.id, '部署長は部署の目標を作れ、上の目標につなげられる');
await boss('PATCH', `/api/org/members/${me.user.id}`, { role: 'member' }, 400);
ok(true, '最後の代表は外せない');

// 年間の10倍KPI
const k1 = await boss('POST', '/api/kpis/annual', { title: '年間売上', metric_unit: '万円', metric_start: 0, metric_target: 12000, link_source: 'freee:sales' });
await boss('POST', '/api/kpis/annual', { title: 'EC売上', metric_unit: '万円', metric_start: 0, metric_target: 3000, link_source: 'shopify:sales' });
await boss('POST', '/api/kpis/annual', { title: '海外の卸先の国数', metric_unit: '国', metric_start: 1, metric_target: 10 });
await boss('POST', '/api/kpis/annual', { title: '4つ目' }, 400);
ok(true, '年間の10倍KPIは3つまで');
await staff('POST', '/api/kpis/annual', { title: '担当は作れない' }, 403);
await boss('PUT', `/api/kpis/annual/${k1.id}/values/2026-09-30`, { value: 5000 });
await boss('PUT', `/api/kpis/annual/${k1.id}/values/2026-10-20`, { value: 6000 });
const ann = await boss('GET', '/api/kpis/annual?year=2026');
const a1 = ann.kpis.find((k) => k.id === k1.id);
ok(a1.metric_current === 6000 && a1.link_source === 'freee:sales' && ['ok', 'warn', 'bad'].includes(a1.signal), '値を入れると現在値と信号が出る');
const vals = await staff('GET', `/api/kpis/annual/${k1.id}/values`);
ok(vals.length === 2 && vals[0].date === '2026-09-30', '推移は日付順で全員が見られる');

// 行動指標（ロックイン）: ルールは共有、記録は人ごと
await boss('PUT', `/api/terms/${term.id}/lockin`, { lockin: true, tenx_goal: '自然茶を世界20か国に' });
const lk = await boss('GET', `/api/terms/${term.id}/lockin`);
const rule = lk.rules.find((r) => r.unit === 'check');
await staff('PUT', `/api/days/2026-12-20/lockin/${rule.id}`, { done: true });
const bossDay = await boss('GET', '/api/days/2026-12-20');
const staffDay = await staff('GET', '/api/days/2026-12-20');
ok(staffDay.lockin.rules.find((r) => r.id === rule.id).done === true, '担当の記録は担当に付く');
ok(bossDay.lockin.rules.find((r) => r.id === rule.id).done === false, 'ほかの人の記録は混ざらない');

// 今日のタスクは人ごと
await staff('POST', '/api/days/2026-12-20/tasks', { title: '商品ページを直す', goal_id: g2.id });
ok((await boss('GET', '/api/days/2026-12-20')).tasks.length === 0, 'タスクは本人だけに見える');
// タイムライン（SNS風）
const staffTask = (await staff('GET', '/api/days/2026-12-20')).tasks[0];
await staff('PATCH', `/api/tasks/${staffTask.id}`, { status: 'done' });
let feed = await boss('GET', '/api/feed');
const auto = feed.posts.find((p) => p.kind === 'task_done' && p.ref_id === staffTask.id);
ok(auto && auto.body === '商品ページを直す' && auto.goal_title === '定期便の会員を+300人', 'タスクをできたにするとタイムラインに出る');
ok(feed.posts.some((p) => p.kind === 'kpi' && p.body.startsWith('年間売上')), 'KPIの値を入れるとタイムラインに出る');
await staff('PATCH', `/api/tasks/${staffTask.id}`, { status: 'todo' });
feed = await boss('GET', '/api/feed');
ok(!feed.posts.some((p) => p.ref_id === staffTask.id), 'できたを取り消すと消える');
await staff('PATCH', `/api/tasks/${staffTask.id}`, { status: 'done' });
const autoId = (await boss('GET', '/api/feed')).posts.find((p) => p.ref_id === staffTask.id).id;
await boss('PUT', `/api/posts/${autoId}/like`, { on: true });
await staff('PATCH', `/api/tasks/${staffTask.id}`, { status: 'todo' });
ok((await boss('GET', '/api/feed')).posts.some((p) => p.id === autoId), 'いいねが付いた投稿は取り消しても残る');

const post = await staff('POST', '/api/posts', { body: 'LPを新しくしました', goal_id: g2.id });
const liked = await boss('PUT', `/api/posts/${post.id}/like`, { on: true });
ok(liked.like_count === 1, 'いいねできる');
await boss('PUT', `/api/posts/${post.id}/like`, { on: true });
ok((await boss('PUT', `/api/posts/${post.id}/like`, { on: true })).like_count === 1, '同じ人のいいねは1回');
await boss('POST', `/api/posts/${post.id}/comments`, { body: 'いいですね' });
const cs = await staff('GET', `/api/posts/${post.id}/comments`);
ok(cs.length === 1 && cs[0].body === 'いいですね', 'コメントできる');
feed = await staff('GET', '/api/feed');
const fp = feed.posts.find((p) => p.id === post.id);
ok(fp.like_count === 1 && fp.comment_count === 1 && fp.liked === false && fp.likers.length === 1 && fp.goal_title === '定期便の会員を+300人', 'タイムラインにいいね・コメントの数と目標が出る');
const outsiderPost = await boss('POST', '/api/posts', { body: '代表の投稿' });
await staff('DELETE', `/api/posts/${outsiderPost.id}`, null, 403);
ok(true, 'ほかの人の投稿は消せない');
await boss('DELETE', `/api/posts/${post.id}`);
ok(!(await boss('GET', '/api/feed')).posts.some((p) => p.id === post.id), '代表は投稿を消せる');

await staff('PUT', '/api/settings/share', { on: false });
const quiet = await staff('POST', '/api/days/2026-12-21/tasks', { title: '静かなタスク' });
await staff('PATCH', `/api/tasks/${quiet.id}`, { status: 'done' });
ok(!(await boss('GET', '/api/feed')).posts.some((p) => p.ref_id === quiet.id), '流さない設定なら、できたは出ない');

const st = await staff('GET', '/api/stories');
ok(st.kpis.length === 3 && st.people[0].me === true && st.people.every((p) => p.id !== 'company'), 'ストーリーズは10倍KPIと、自分が先頭のメンバー');
const prof = await boss('GET', `/api/people/${sme.user.id}`);
ok(prof.person.department_name === 'EC' && prof.goals.some((x) => x.id === g2.id) && prof.stats.posts >= 1, 'プロフィールに部署・担当の目標・投稿数');
const page1 = await boss('GET', '/api/feed?limit=2');
const page2 = await boss('GET', `/api/feed?limit=2&before=${encodeURIComponent(page1.next)}`);
ok(page1.posts.length === 2 && page2.posts.length >= 1 && !page2.posts.some((p) => page1.posts.some((q) => q.id === p.id)), 'タイムラインの続きを読める');
console.log('ALL OK');
