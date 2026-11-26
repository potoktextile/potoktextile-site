/* ============================================================
   ПОТОК ТЕКСТИЛЬ — логика каталога
   ============================================================ */

/* ---------- Каталог ----------
   Сами товары и цены лежат в catalog.js — там обычная таблица, её и правьте.
   Здесь только разбор этой таблицы в объекты. */
const PHOTO_DIR = 'images/products/';

/* названия категорий из таблицы -> ключи кнопок фильтра в index.html */
const CATS = {
  'костюмы':'suits',
  'платья':'dresses',
  'домашняя одежда':'home',
};

/* "sm-fl-002-ivory/1..12" -> ['sm-fl-002-ivory/1', ..., 'sm-fl-002-ivory/12'] */
function expandRange(item){
  const m = item.match(/^(.*\/)(\d+)\.\.(\d+)$/);
  if (!m) return [item];
  const [, base, from, to] = m;
  const out = [];
  for (let i = +from; i <= +to; i++) out.push(base + i);
  return out;
}

/* "48-62" -> [48,50,...,62];  "48,52,56" -> [48,52,56] */
function parseSizes(str){
  if (str.includes(',')) return str.split(',').map(s => +s.trim()).filter(Boolean);
  const [from, to] = str.split('-').map(s => +s.trim());
  if (!from) return [];
  if (!to) return [from];
  const out = [];
  for (let s = from; s <= to; s += 2) out.push(s);
  return out;
}

function parseCatalog(text){
  const items = [];
  text.split('\n').forEach((line, n) => {
    const row = line.trim();
    if (!row || row.startsWith('#')) return;

    const col = row.split('|').map(c => c.trim());
    if (col.length < 6){
      console.warn(`catalog.js, строка ${n + 1}: нужно 6 колонок, найдено ${col.length} — строка пропущена:\n${row}`);
      return;
    }

    const [art, name, catName, priceStr, sizesStr, photoStr, colorStr = ''] = col;
    const price = +priceStr.replace(/[^\d]/g, '');
    const cat = CATS[catName.toLowerCase()];

    if (!name){
      console.warn(`catalog.js, строка ${n + 1}: пустое название — строка пропущена:\n${row}`);
      return;
    }
    if (!cat) console.warn(`catalog.js, строка ${n + 1}: неизвестная категория «${catName}» — товар будет виден только во «Всех категориях»`);

    /* «Голубой #BACBDC» -> название цвета + образец */
    const hex = (colorStr.match(/#[0-9a-f]{3,8}/i) || [''])[0];
    const color = colorStr.replace(/#[0-9a-f]{3,8}/i, '').trim();

    const photos = photoStr.split(',').map(s => s.trim()).filter(Boolean).flatMap(expandRange);
    items.push({
      art, name, price, cat, color, hex,
      sizes: parseSizes(sizesStr),
      /* 'sm-fl-002/1' — подготовленное фото с превью, 'p2' — картинка images/p2.jpg */
      photos: photos.filter(s => s.includes('/')),
      img: photos.find(s => !s.includes('/')) ? `images/${photos.find(s => !s.includes('/'))}.jpg` : '',
    });
  });
  return groupByColor(items);
}

/* строки одной модели (одинаковое название + заполнен цвет) -> одна карточка с вариантами */
function groupByColor(rows){
  const out = [], byName = new Map();
  rows.forEach(r => {
    const key = r.color ? r.name.toLowerCase() : null;
    if (key && byName.has(key)){
      byName.get(key).variants.push(r);
      return;
    }
    const item = {
      id: out.length + 1,
      name: r.name,
      cat: r.cat,
      active: 0,
      variants: [r],
    };
    if (key) byName.set(key, item);
    out.push(item);
  });
  return out;
}

/* активный цветовой вариант товара */
const cur = p => p.variants[p.active] || p.variants[0];

const PRODUCTS = typeof CATALOG === 'string' ? parseCatalog(CATALOG) : [];
if (!PRODUCTS.length) console.error('Каталог пуст: проверьте catalog.js — подключён ли файл и заполнена ли таблица.');

/* ---------- Заглушка изображения (пока нет фото) ---------- */
function placeholder(label){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
    <rect width="300" height="400" fill="#EFE7DA"/>
    <path d="M150 120c17 0 30-13 30-29s-13-29-30-29-30 13-30 29 13 29 30 29Z" fill="#DCCFBB"/>
    <path d="M60 400c0-56 40-101 90-101s90 45 90 101H60Z" fill="#DCCFBB"/>
    <text x="150" y="380" text-anchor="middle" font-family="Montserrat,Arial" font-size="13" fill="#9A9188">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function placeholderFlat(color, label){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="${color}"/>
    <text x="400" y="256" text-anchor="middle" font-family="Montserrat,Arial" font-size="20" fill="#6E665C">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
/* если файла нет — подставляем заглушку */
document.addEventListener('error', e => {
  const el = e.target;
  if (el.tagName !== 'IMG' || el.dataset.fallback) return;
  el.dataset.fallback = '1';
  const kind = el.dataset.ph;
  el.src = kind === 'dark'  ? placeholderFlat('#2A2622','ФОТО ПРОИЗВОДСТВА')
         : kind === 'model' ? placeholder('ФОТО МОДЕЛИ')
         : placeholder(el.alt || 'ФОТО');
}, true);

/* ---------- Состояние ---------- */
const state = {
  cat:'all',
  sizes:[],
  query:'',
  favs: JSON.parse(localStorage.getItem('potok_favs') || '[]'),
};

const $products = document.getElementById('products');
const $empty    = document.getElementById('empty');

const money = n => n.toLocaleString('ru-RU').replace(/,/g,' ') + ' сом';
/* цена подтверждена не у всех моделей — выдуманную не показываем */
const priceLabel = v => v.price ? money(v.price) : 'Цена по запросу';
/* Артикулы и размеры покупателю пока не показываем — в карточке остаются
   только название, цена и цвета. Сами данные лежат в catalog.js без изменений:
   размеры по-прежнему работают в фильтре, артикул — во внутреннем поиске. */
const sizeRange = s => Math.min(...s) === Math.max(...s)
  ? `${s[0]}` : `${Math.min(...s)}-${Math.max(...s)}`;

/* фото товара: [{thumb, full}, ...] */
const photosOf = p => p.photos?.length
  ? p.photos.map(n => ({ thumb:`${PHOTO_DIR}${n}-thumb.jpg`, full:`${PHOTO_DIR}${n}.jpg` }))
  : [{ thumb:p.img, full:p.img }];

/* ---------- Рендер ---------- */
function filtered(){
  return PRODUCTS.filter(p => {
    if (state.cat !== 'all' && p.cat !== state.cat) return false;
    /* товар подходит, если размер есть хотя бы у одного цвета */
    if (state.sizes.length &&
        !p.variants.some(v => state.sizes.some(s => v.sizes.includes(s)))) return false;
    if (state.query){
      const hay = (p.name + ' ' + p.variants.map(v => v.art + ' ' + v.color).join(' ')).toLowerCase();
      if (!hay.includes(state.query)) return false;
    }
    return true;
  });
}

/* кружки-образцы цвета */
function swatches(p, cls){
  if (p.variants.length < 2) return '';
  return `<div class="${cls}">` + p.variants.map((v, n) =>
    `<button class="swatch${n === p.active ? ' is-active' : ''}" data-color="${p.id}:${n}"
             style="--c:${v.hex || '#DDD'}" title="${v.color || v.art}"
             aria-label="Цвет: ${v.color || v.art}"></button>`
  ).join('') + '</div>';
}

function render(){
  const list = filtered();
  $empty.hidden = list.length > 0;

  $products.innerHTML = list.map((p,i) => {
    const v = cur(p);
    const shots = photosOf(v);
    return `
    <article class="product" data-card="${p.id}" style="animation-delay:${i * 35}ms">
      <button class="product__media" data-open="${p.id}" aria-label="Посмотреть «${p.name}»">
        <img src="${shots[0].thumb}" alt="${p.name}${v.color ? ', цвет ' + v.color : ''}" loading="lazy">
        ${shots.length > 1 ? `<span class="product__count">${shots.length} фото</span>` : ''}
        <span class="product__zoom">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2A2A2A" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21M11 8v6M8 11h6" stroke-linecap="round"/></svg>
        </span>
      </button>
      <button class="fav ${state.favs.includes(p.id) ? 'is-active' : ''}"
              data-id="${p.id}" aria-label="В избранное" aria-pressed="${state.favs.includes(p.id)}">
        <svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.7-9.3-9A5 5 0 0 1 12 6.6 5 5 0 0 1 21.3 11c-1.8 4.3-9.3 9-9.3 9Z" stroke-linejoin="round"/></svg>
      </button>
      <h3 class="product__name">${p.name}</h3>
      <p class="product__price">${priceLabel(v)}</p>
      ${swatches(p, 'swatches')}
    </article>`;
  }).join('');
}

/* переключение цвета: обновляем только затронутую карточку */
function setColor(id, n){
  const p = PRODUCTS.find(x => x.id === id);
  if (!p || !p.variants[n]) return;
  p.active = n;
  const v = p.variants[n];
  const card = $products.querySelector(`[data-card="${id}"]`);
  if (!card) return;

  const shots = photosOf(v);
  const img = card.querySelector('.product__media img');
  img.src = shots[0].thumb;
  img.alt = `${p.name}${v.color ? ', цвет ' + v.color : ''}`;

  const count = card.querySelector('.product__count');
  if (shots.length > 1){
    if (count) count.textContent = `${shots.length} фото`;
    else card.querySelector('.product__media')
             .insertAdjacentHTML('beforeend', `<span class="product__count">${shots.length} фото</span>`);
  } else if (count) count.remove();

  card.querySelector('.product__price').textContent = priceLabel(v);
  card.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('is-active', i === n));

  /* если открыт просмотр этого товара — переключаем и его */
  if (lb.root && !lb.root.hidden && lb.product === p) openProduct(id, true);
}

$products?.addEventListener('click', e => {
  const sw = e.target.closest('[data-color]');
  if (!sw) return;
  const [id, n] = sw.dataset.color.split(':').map(Number);
  setColor(id, n);
});

/* ---------- Категории ---------- */
document.getElementById('cats')?.addEventListener('click', e => {
  const btn = e.target.closest('.cats__btn');
  if (!btn) return;
  document.querySelectorAll('.cats__btn').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  state.cat = btn.dataset.cat;
  render();
});

/* ---------- Размеры ---------- */
document.getElementById('applyFilters')?.addEventListener('click', () => {
  state.sizes = [...document.querySelectorAll('#sizes input:checked')].map(i => +i.value);
  render();
  document.getElementById('catalog').scrollIntoView({ behavior:'smooth', block:'start' });
});

/* ---------- Поиск ---------- */
const $search = document.getElementById('siteSearch');
let searchTimer;
$search?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = $search.value.trim().toLowerCase();
    render();
  }, 200);
});
$search?.closest('form')?.addEventListener('submit', () => {
  state.query = $search.value.trim().toLowerCase();
  render();
  document.getElementById('catalog').scrollIntoView({ behavior:'smooth' });
});

/* ---------- Сброс фильтров ---------- */
document.getElementById('showAll')?.addEventListener('click', e => {
  e.preventDefault();
  state.cat = 'all'; state.sizes = []; state.query = '';
  $search.value = '';
  document.querySelectorAll('#sizes input').forEach(i => i.checked = false);
  document.querySelectorAll('.cats__btn').forEach(b =>
    b.classList.toggle('is-active', b.dataset.cat === 'all'));
  render();
});

/* ---------- Избранное ---------- */
$products?.addEventListener('click', e => {
  const btn = e.target.closest('.fav');
  if (!btn) return;
  const id = +btn.dataset.id;
  const i  = state.favs.indexOf(id);
  i === -1 ? state.favs.push(id) : state.favs.splice(i, 1);
  localStorage.setItem('potok_favs', JSON.stringify(state.favs));
  btn.classList.toggle('is-active', i === -1);
  btn.setAttribute('aria-pressed', i === -1);
});

/* ---------- Просмотр фото / галерея ---------- */
const lb = {
  root:  document.getElementById('lightbox'),
  img:   document.getElementById('lbImg'),
  name:  document.getElementById('lbName'),
  meta:  document.getElementById('lbMeta'),
  price: document.getElementById('lbPrice'),
  order: document.getElementById('lbOrder'),
  dots:  document.getElementById('lbDots'),
  colors:document.getElementById('lbColors'),
  prev:  document.getElementById('lbPrev'),
  next:  document.getElementById('lbNext'),
  shots: [],
  product: null,
  i: 0,
};

function lbShow(i){
  lb.i = (i + lb.shots.length) % lb.shots.length;
  lb.img.src = lb.shots[lb.i].full;
  [...lb.dots.children].forEach((d, n) => {
    const on = n === lb.i;
    d.classList.toggle('is-active', on);
    if (on) d.scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});
  });
  /* тихо подгружаем следующее фото, чтобы листалось без паузы */
  if (lb.shots.length > 1) new Image().src = lb.shots[(lb.i + 1) % lb.shots.length].full;
}

function openProduct(id, keepOpen){
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const v = cur(p);

  lb.product = p;
  lb.shots = photosOf(v);
  lb.img.alt   = p.name;
  lb.name.textContent  = p.name;
  lb.meta.textContent  = v.color || '';
  lb.price.textContent = priceLabel(v);
  lb.order.href = 'https://wa.me/996555858903?text=' +
    encodeURIComponent(`Здравствуйте! Интересует модель «${p.name}»` +
                       (v.color ? `, цвет ${v.color}` : '') + '.');
  lb.colors.innerHTML = swatches(p, 'lb__swatches');

  const many = lb.shots.length > 1;
  lb.prev.hidden = lb.next.hidden = !many;
  lb.dots.innerHTML = many
    ? lb.shots.map((s, n) =>
        `<button data-go="${n}" aria-label="Фото ${n + 1}"><img src="${s.thumb}" alt="" loading="lazy"></button>`
      ).join('')
    : '';

  lbShow(0);
  lb.root.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLb(){
  lb.root.hidden = true;
  lb.img.removeAttribute('src');   /* пустой src грузит страницу заново */
  document.body.style.overflow = '';
}

$products?.addEventListener('click', e => {
  const opener = e.target.closest('[data-open]');
  if (opener) openProduct(+opener.dataset.open);
});

lb.root?.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeLb();
  const sw = e.target.closest('[data-color]');
  if (sw){
    const [id, n] = sw.dataset.color.split(':').map(Number);
    return setColor(id, n);
  }
  const dot = e.target.closest('[data-go]');
  if (dot) lbShow(+dot.dataset.go);
});
lb.prev?.addEventListener('click', () => lbShow(lb.i - 1));
lb.next?.addEventListener('click', () => lbShow(lb.i + 1));

document.addEventListener('keydown', e => {
  if (!lb.root || lb.root.hidden) return;
  if (e.key === 'Escape')     closeLb();
  if (e.key === 'ArrowLeft')  lbShow(lb.i - 1);
  if (e.key === 'ArrowRight') lbShow(lb.i + 1);
});

/* свайп по фото на телефоне */
let touchX = null;
lb.root?.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, {passive:true});
lb.root?.addEventListener('touchend', e => {
  if (touchX === null || lb.shots.length < 2) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 45) lbShow(lb.i + (dx < 0 ? 1 : -1));
  touchX = null;
}, {passive:true});

/* ---------- Год в футере ---------- */
const $year = document.getElementById('year');
if ($year) $year.textContent = new Date().getFullYear();

/* ---------- Мобильное меню ---------- */
const $burger = document.getElementById('burger');
const $nav    = document.getElementById('nav');
$burger.addEventListener('click', () => {
  const open = $nav.classList.toggle('is-open');
  $burger.classList.toggle('is-open', open);
  $burger.setAttribute('aria-expanded', open);
});
$nav.addEventListener('click', e => {
  if (e.target.tagName === 'A'){
    $nav.classList.remove('is-open');
    $burger.classList.remove('is-open');
    $burger.setAttribute('aria-expanded', false);
  }
});

/* ---------- B2B: форма заявки (b2b.html) ----------
   Backend не подключён. Пока форма собирает заполненные поля
   в сообщение и открывает WhatsApp. Когда появится серверный
   обработчик — заменить тело submit на обычную отправку fetch/POST,
   разметку формы менять не придётся. */
const $b2bForm = document.getElementById('b2bForm');
if ($b2bForm){
  const $status = document.getElementById('b2bStatus');
  const LABELS = {
    name:'Имя', company:'Компания', phone:'Телефон/WhatsApp', geo:'Страна/город',
    what:'Что произвести', qty:'Количество', comment:'Комментарий',
  };

  $b2bForm.addEventListener('submit', e => {
    e.preventDefault();

    // проверяем обязательные поля, не мешая браузерной валидации
    const missing = [...$b2bForm.querySelectorAll('[required]')].filter(i => !i.value.trim());
    if (missing.length){
      missing[0].focus();
      $status.textContent = 'Заполните обязательные поля.';
      return;
    }

    const lines = Object.keys(LABELS)
      .map(key => {
        const el = $b2bForm.elements[key];
        const val = el && el.value.trim();
        return val ? `${LABELS[key]}: ${val}` : null;
      })
      .filter(Boolean);

    /* Локальный файл через wa.me передать нельзя — только предупреждаем
       менеджера, что ТЗ придёт следующим сообщением. */
    const file = $b2bForm.elements.file;
    const hasFile = !!(file && file.files && file.files.length);
    if (hasFile){
      lines.push('📎 Техническое задание / файл: прикреплю следующим сообщением.');
    }

    const text = 'Заявка на производство\n\n' + lines.join('\n');

    $status.textContent = hasFile
      ? 'Заявка сформирована. Прикрепите выбранный файл к сообщению в WhatsApp вручную.'
      : 'Заявка сформирована. Открываем WhatsApp…';

    window.open('https://wa.me/996555858903?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
}

/* ---------- B2B: галерея бренда «показать все фото» ----------
   В блоке бренда лежат все его фотографии, но по умолчанию видно только
   первые ряды — иначе страница растягивается на десятки экранов.
   Скрытые превью выключены через display:none, поэтому их файлы не грузятся,
   пока галерею не раскроют. */
const brandMores = [...document.querySelectorAll('.brand [data-more]')].map(btn => {
  const brand = btn.closest('.brand');
  const label = btn.querySelector('[data-more-text]');
  const shots = [...brand.querySelectorAll('.brand__shot')];

  /* сколько превью помещается в свёрнутую сетку, зависит от ширины экрана,
     поэтому кнопку показываем только когда что-то действительно скрыто */
  const sync = () => {
    const open = brand.classList.contains('is-open');
    btn.hidden = !open && shots.every(sh => sh.offsetParent !== null);
    label.textContent = open ? 'Свернуть' : `Показать все ${shots.length} фото`;
  };

  btn.addEventListener('click', () => {
    const open = brand.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open);
    sync();
    if (!open) brand.scrollIntoView({block:'start', behavior:'smooth'});
  });

  sync();
  return sync;
});

if (brandMores.length){
  let t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => brandMores.forEach(f => f()), 150);
  });
}

/* ---------- B2B: просмотр фото кейса (b2b.html) ----------
   Отдельный лёгкий просмотрщик: у кейса нет цены, размеров и артикула,
   поэтому каталожный openProduct здесь не подходит. Оверлей переиспользует
   те же классы .lb, библиотека не подключается. */
const $caseLb = document.getElementById('caseLb');
if ($caseLb){
  /* Кейсов на странице несколько, поэтому стрелки листают только внутри
     того проекта, фотографию которого открыли. */
  let shots = [];
  const img   = document.getElementById('caseLbImg');
  const cap   = document.getElementById('caseLbCap');
  const prev  = document.getElementById('caseLbPrev');
  const next  = document.getElementById('caseLbNext');
  let i = 0;

  const show = n => {
    i = (n + shots.length) % shots.length;
    const b = shots[i];
    img.src = b.dataset.shot;
    img.alt = b.querySelector('img').alt;
    cap.textContent = b.dataset.caption || '';
    if (shots.length > 1) new Image().src = shots[(i + 1) % shots.length].dataset.shot;
  };

  const open = n => {
    show(n);
    $caseLb.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    $caseLb.hidden = true;
    img.removeAttribute('src');   /* пустой src грузит страницу заново */
    document.body.style.overflow = '';
  };

  /* .case-main — большие кейсы, .brand — карточки производства для брендов */
  document.querySelectorAll('.case-main, .brand').forEach(block => {
    const group = [...block.querySelectorAll('.case-shot, .brand__shot')];
    if (!group.length) return;
    group.forEach((b, n) => b.addEventListener('click', () => {
      shots = group;
      prev.hidden = next.hidden = shots.length < 2;
      open(n);
    }));
  });

  $caseLb.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  prev.addEventListener('click', () => show(i - 1));
  next.addEventListener('click', () => show(i + 1));

  document.addEventListener('keydown', e => {
    if ($caseLb.hidden) return;
    if (e.key === 'Escape')    close();
    if (e.key === 'ArrowLeft')  show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });

  /* свайп на телефоне */
  let tx = null;
  $caseLb.addEventListener('touchstart', e => { tx = e.changedTouches[0].clientX; }, {passive:true});
  $caseLb.addEventListener('touchend', e => {
    if (tx === null || shots.length < 2) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 45) show(i + (dx < 0 ? 1 : -1));
    tx = null;
  }, {passive:true});
}

/* ---------- B2B: кнопка ведёт к форме и подсказывает, о чём заявка ----------
   Заполняем поле «Что необходимо произвести?», только если клиент его
   ещё не трогал, — ничего введённого руками не перетираем. */
document.querySelectorAll('a[data-prefill][href="#quote"]').forEach(link => {
  link.addEventListener('click', () => {
    const what = document.getElementById('f-what');
    if (what && !what.value.trim()) what.value = link.dataset.prefill;
  });
});

/* ---------- Кнопка WhatsApp: не мешает во время прокрутки ---------- */
const $fab = document.querySelector('.fab');
if ($fab){
  let idleTimer;
  const wake = () => {
    $fab.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => $fab.classList.add('is-idle'), 600);
  };
  wake();
  window.addEventListener('scroll', wake, {passive:true});
}

if ($products) render();
