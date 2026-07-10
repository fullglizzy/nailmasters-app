import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ═══════════════════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════════════════

  // Admin
  const [admin] = await db.insert(schema.users).values({
    phone: '+15550000001',
    username: 'admin',
    role: 'admin',
  }).onConflictDoNothing().returning();
  if (admin) {
    await db.insert(schema.adminProfiles).values({
      userId: admin.id, fullName: 'Admin', phone: '+15550000001', permissions: ['all'],
    }).onConflictDoNothing();
    console.log('👑 Admin: +15550000001');
  }

  // Masters
  const masterData = [
    { username: 'anna_nails', fullName: 'Анна Петрова', phone: '+15550000101',
      description: 'Топ-мастер с 7-летним опытом. Сложные дизайны, наращивание, укрепление. Премиум-материалы.',
      experience: '7 лет', city: 'New York',
      specialties: ['Маникюр', 'Педикюр', 'Наращивание', 'Дизайн ногтей', 'Укрепление'],
      startingPrice: '45', workFormat: ['salon'], sterilization: true, disposableTools: true,
      latitude: '40.7128', longitude: '-74.0060' },
    { username: 'elena_beauty', fullName: 'Елена Соколова', phone: '+15550000102',
      description: 'Маникюр и педикюр. Минимализм и элегантные дизайны. Уютный салон в центре Москвы.',
      experience: '4 года', city: 'New York',
      specialties: ['Маникюр', 'Педикюр', 'Дизайн ногтей', 'Shellac'],
      startingPrice: '35', workFormat: ['salon', 'home'], sterilization: true, disposableTools: true,
      latitude: '40.7580', longitude: '-73.9855' },
    { username: 'olga_nailart', fullName: 'Ольга Иванова', phone: '+15550000103',
      description: 'Креативный мастер. Эксперименты с цветом и текстурой. Уникальные дизайны под образ.',
      experience: '3 года', city: 'Los Angeles',
      specialties: ['Маникюр', 'Наращивание', 'Дизайн ногтей', 'Аэрография'],
      startingPrice: '50', workFormat: ['salon'], sterilization: true, disposableTools: false,
      latitude: '34.0522', longitude: '-118.2437' },
    { username: 'maria_nails', fullName: 'Мария Кузнецова', phone: '+15550000104',
      description: 'Сертифицированный мастер с международными дипломами. Любые типы ногтей. Качество и стойкость.',
      experience: '6 лет', city: 'San Francisco',
      specialties: ['Маникюр', 'Педикюр', 'Наращивание', 'Дизайн ногтей', 'Парафинотерапия'],
      startingPrice: '65', workFormat: ['salon'], sterilization: true, disposableTools: true,
      latitude: '37.7749', longitude: '-122.4194' },
    { username: 'daria_nails', fullName: 'Дарья Морозова', phone: '+15550000105',
      description: 'Художественное образование. Роспись любой сложности — портреты, пейзажи, репродукции.',
      experience: '5 лет', city: 'Chicago',
      specialties: ['Маникюр', 'Дизайн ногтей', 'Роспись', 'Наращивание'],
      startingPrice: '40', workFormat: ['home'], sterilization: true, disposableTools: true,
      latitude: '41.8781', longitude: '-87.6298' },
  ];

  const masterUsers: typeof schema.users.$inferSelect[] = [];
  for (const m of masterData) {
    const [user] = await db.insert(schema.users).values({
      phone: m.phone, username: m.username, role: 'nailmaster',
    }).onConflictDoNothing().returning();
    if (user) {
      masterUsers.push(user);
      await db.insert(schema.masterProfiles).values({
        userId: user.id, fullName: m.fullName, phone: m.phone,
        description: m.description, experience: m.experience, city: m.city,
        isModerated: true, specialties: m.specialties, startingPrice: m.startingPrice,
        workFormat: m.workFormat, sterilization: m.sterilization, disposableTools: m.disposableTools,
        latitude: m.latitude, longitude: m.longitude,
      }).onConflictDoNothing();
      console.log(`💅 Master: ${m.fullName} — ${m.phone} (${m.city})`);
    }
  }

  // Clients
  const clientData = [
    { username: 'elena_client', fullName: 'Елена Иванова', phone: '+15550000201', latitude: '40.7128', longitude: '-74.0060' },
    { username: 'katya_style', fullName: 'Екатерина Смирнова', phone: '+15550000202', latitude: '40.7580', longitude: '-73.9855' },
    { username: 'nastya_love', fullName: 'Анастасия Волкова', phone: '+15550000203', latitude: '34.0522', longitude: '-118.2437' },
    { username: 'sasha_nails', fullName: 'Александра Попова', phone: '+15550000204', latitude: '41.8781', longitude: '-87.6298' },
  ];

  const clientUsers: typeof schema.users.$inferSelect[] = [];
  for (const c of clientData) {
    const [user] = await db.insert(schema.users).values({
      phone: c.phone, username: c.username, role: 'client',
    }).onConflictDoNothing().returning();
    if (user) {
      clientUsers.push(user);
      await db.insert(schema.clientProfiles).values({
        userId: user.id, fullName: c.fullName, phone: c.phone,
        latitude: c.latitude, longitude: c.longitude,
      }).onConflictDoNothing();
      console.log(`👤 Client: ${c.fullName} — ${c.phone}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 2. DESIGNS
  // ═══════════════════════════════════════════════════════

  console.log('\n📸 Creating designs...');

  const designData = [
    { title: 'Нежный френч с цветочным узором', description: 'Классический френч с акварельными цветами на безымянном пальце. Пастельные тона — идеально для весны.',
      color: 'Розовый', length: 'medium', shape: 'almond', season: 'spring',
      techniques: ['Френч', 'Акварель', 'Роспись'], moodTags: ['Нежный', 'Романтичный', 'Весенний'],
      materials: ['Гель-лак', 'Акриловые краски'], tags: ['френч', 'цветы', 'весна', 'нежный', 'розовый', 'акварель'] },
    { title: 'Мраморный маникюр с золотом', description: 'Эффектный мрамор с тонкими золотыми линиями. Благородный стиль для особого случая.',
      color: 'Белый', length: 'long', shape: 'stiletto', season: 'winter',
      techniques: ['Мрамор', 'Фольга'], moodTags: ['Гламур', 'Праздничный', 'Вечерний'],
      materials: ['Гель', 'Фольга'], tags: ['мрамор', 'золото', 'вечерний', 'белый', 'гламур'] },
    { title: 'Яркий летний градиент', description: 'Сочный градиент от оранжевого к розовому с блёстками. Поднимает настроение!',
      color: 'Оранжевый', length: 'short', shape: 'square', season: 'summer',
      techniques: ['Градиент', 'Блестки'], moodTags: ['Яркий', 'Летний', 'Повседневный'],
      materials: ['Гель-лак', 'Блестки'], tags: ['градиент', 'лето', 'яркий', 'оранжевый'] },
    { title: 'Minimal nude + геометрия', description: 'Элегантный nude с тонкими геометрическими линиями. Идеально для офиса и повседневной носки.',
      color: 'Нюдовый', length: 'medium', shape: 'soft_square', season: 'fall',
      techniques: ['Минимализм', 'Геометрия'], moodTags: ['Минимализм', 'Офисный', 'Элегантный'],
      materials: ['Гель-лак'], tags: ['минимализм', 'nude', 'геометрия', 'офис'] },
    { title: 'Кошачий глаз + жемчужная втирка', description: 'Магнитный гель-лак с жемчужной втиркой. Глубокий переливающийся эффект.',
      color: 'Синий', length: 'long', shape: 'almond', season: 'winter',
      techniques: ['Кошачий глаз', 'Втирка'], moodTags: ['Гламур', 'Вечерний', 'Загадочный'],
      materials: ['Гель-лак', 'Магнитный гель', 'Втирка'], tags: ['кошачий глаз', 'втирка', 'синий'] },
    { title: 'Свадебный маникюр с кружевом', description: 'Нежнейший свадебный дизайн: белая база, кружевная роспись, стразы Swarovski.',
      color: 'Белый', length: 'medium', shape: 'oval', season: 'summer',
      techniques: ['Роспись', 'Стразы'], moodTags: ['Свадебный', 'Романтичный', 'Нежный'],
      materials: ['Гель', 'Стразы', 'Акриловая пудра'], tags: ['свадьба', 'кружево', 'стразы', 'белый'] },
    { title: 'Осенний маникюр с листьями', description: 'Тёплая осенняя палитра с золотыми листьями. Уютный дизайн для прохладных дней.',
      color: 'Красный', length: 'medium', shape: 'almond', season: 'fall',
      techniques: ['Роспись', 'Фольга', 'Стемпинг'], moodTags: ['Осенний', 'Уютный'],
      materials: ['Гель-лак', 'Фольга', 'Краски'], tags: ['осень', 'листья', 'золото', 'красный'] },
    { title: 'Black chrome', description: 'Дерзкий чёрный маникюр с хромированными акцентами. Для смелых и стильных.',
      color: 'Черный', length: 'long', shape: 'ballerina', season: 'winter',
      techniques: ['Хром', 'Градиент'], moodTags: ['Дерзкий', 'Вечерний', 'Гламур'],
      materials: ['Гель', 'Хром'], tags: ['черный', 'хром', 'готика', 'дерзкий'] },
    { title: 'Радужный омбре на короткие', description: 'Весёлый радужный омбре — каждый ноготь новый цвет. Позитив гарантирован!',
      color: 'Разноцветный', length: 'short', shape: 'square', season: 'summer',
      techniques: ['Омбре', 'Градиент'], moodTags: ['Яркий', 'Креативный'],
      materials: ['Гель-лак'], tags: ['радуга', 'омбре', 'короткие', 'лето'] },
    { title: 'Зимняя сказка со снежинками', description: 'Голубая база с белыми снежинками и серебряными блёстками. Новогоднее настроение.',
      color: 'Голубой', length: 'medium', shape: 'round', season: 'winter',
      techniques: ['Роспись', 'Блестки', 'Стемпинг'], moodTags: ['Праздничный', 'Зимний', 'Сказочный'],
      materials: ['Гель-лак', 'Блестки'], tags: ['зима', 'снежинки', 'новый год', 'голубой'] },
    { title: 'Бордовый бархат с золотом', description: 'Эффект бархата на глубоком бордовом фоне с золотыми полосками. Роскошный вечерний вариант.',
      color: 'Бордовый', length: 'long', shape: 'almond', season: 'fall',
      techniques: ['Бархат', 'Фольга'], moodTags: ['Вечерний', 'Гламур', 'Роскошный'],
      materials: ['Гель', 'Бархатная пудра', 'Фольга'], tags: ['бархат', 'бордовый', 'золото'] },
    { title: 'Пастельная геометрия', description: 'Нежные пастельные треугольники и линии на nude-базе. Модный геометричный дизайн.',
      color: 'Нюдовый', length: 'medium', shape: 'soft_square', season: 'spring',
      techniques: ['Геометрия', 'Минимализм'], moodTags: ['Минимализм', 'Современный'],
      materials: ['Гель-лак'], tags: ['геометрия', 'пастель', 'минимализм', 'nude'] },
    { title: 'Тропические листья монстеры', description: 'Зелёные листья монстеры на прозрачной базе. Свежий тропический дизайн для отпуска.',
      color: 'Зеленый', length: 'medium', shape: 'oval', season: 'summer',
      techniques: ['Роспись'], moodTags: ['Летний', 'Креативный', 'Яркий'],
      materials: ['Гель-лак', 'Акриловые краски'], tags: ['тропики', 'листья', 'зеленый', 'монстера'] },
    { title: 'Розовый кварц', description: 'Имитация розового кварца с тонкими тёмными прожилками. Натуральный каменный эффект.',
      color: 'Розовый', length: 'medium', shape: 'almond', season: 'spring',
      techniques: ['Мрамор', 'Роспись'], moodTags: ['Нежный', 'Натуральный', 'Элегантный'],
      materials: ['Гель', 'Краски'], tags: ['кварц', 'розовый', 'камень'] },
    { title: 'Красный глянец + negative space', description: 'Ярко-красный лак с геометричными вырезами негативного пространства. Смело.',
      color: 'Красный', length: 'long', shape: 'stiletto', season: 'summer',
      techniques: ['Негативное пространство', 'Геометрия'], moodTags: ['Дерзкий', 'Страстный'],
      materials: ['Гель-лак'], tags: ['красный', 'негативное пространство', 'глянец'] },
  ];

  const createdDesigns: typeof schema.nailDesigns.$inferSelect[] = [];
  for (let i = 0; i < designData.length; i++) {
    const d = designData[i];
    const master = masterUsers[i % masterUsers.length];
    const [design] = await db.insert(schema.nailDesigns).values({
      title: d.title, description: d.description,
      images: [
        `/uploads/designs/image-${(i * 2) + 1}.jpg`,
        `/uploads/designs/image-${(i * 2) + 2}.jpg`,
      ],
      type: 'designer', source: 'master',
      tags: d.tags, color: d.color,
      techniques: d.techniques, length: d.length, shape: d.shape,
      season: d.season, moodTags: d.moodTags, materials: d.materials,
      durationMinutes: 60 + Math.floor(Math.random() * 60),
      isModerated: true,
      likesCount: Math.floor(Math.random() * 200) + 10,
      ordersCount: Math.floor(Math.random() * 30),
      uploadedByMasterId: master?.id,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 3600 * 1000)),
    }).returning();
    if (design) createdDesigns.push(design);
  }
  console.log(`💅 ${createdDesigns.length} designs created`);

  // ═══════════════════════════════════════════════════════
  // 3. MASTER "CAN DO" LINKS (masterDesigns)
  // ═══════════════════════════════════════════════════════

  let canDoLinks = 0;
  for (const master of masterUsers) {
    // Each master picks 6-10 designs from OTHER masters to "can do"
    const othersDesigns = createdDesigns.filter((d) => d.uploadedByMasterId !== master.id);
    const shuffled = [...othersDesigns].sort(() => Math.random() - 0.5);
    const count = 6 + Math.floor(Math.random() * 5); // 6-10 designs
    for (const design of shuffled.slice(0, count)) {
      await db.insert(schema.masterDesigns).values({
        nailMasterId: master.id,
        nailDesignId: design.id,
        customPrice: String(Math.floor(Math.random() * 40) + 10), // $10-$50
        estimatedDuration: 20 + Math.floor(Math.random() * 40),
      }).onConflictDoNothing();
      canDoLinks++;
    }
  }
  console.log(`🔗 ${canDoLinks} "can do" links`);

  // ═══════════════════════════════════════════════════════
  // 4. SERVICES
  // ═══════════════════════════════════════════════════════

  const serviceTemplates = [
    { name: 'Manicure + gel', description: 'Classic manicure + solid gel polish', price: '35', duration: 60 },
    { name: 'Manicure + design', description: 'Full manicure with nail art', price: '55', duration: 90 },
    { name: 'Nail extensions', description: 'Gel nail extensions on forms', price: '75', duration: 120 },
    { name: 'Express manicure', description: 'Quick manicure with solid color', price: '25', duration: 45 },
    { name: 'Pedicure + gel', description: 'Full pedicure + gel polish', price: '50', duration: 75 },
    { name: 'Nail strengthen', description: 'Acrylic powder nail strengthening', price: '20', duration: 30 },
    { name: 'Removal + new set', description: 'Old gel removal + fresh manicure', price: '55', duration: 90 },
  ];

  const createdServices: typeof schema.masterServices.$inferSelect[] = [];
  for (const master of masterUsers) {
    const num = 3 + Math.floor(Math.random() * 4);
    const shuffled = [...serviceTemplates].sort(() => Math.random() - 0.5);
    for (let i = 0; i < num; i++) {
      const t = shuffled[i];
      const [svc] = await db.insert(schema.masterServices).values({
        name: t.name, description: t.description, price: t.price, duration: t.duration,
        masterId: master.id,
      }).returning();
      if (svc) createdServices.push(svc);
    }
  }
  console.log(`🔧 ${createdServices.length} services`);

  // ═══════════════════════════════════════════════════════
  // 5. SCHEDULE
  // ═══════════════════════════════════════════════════════

  const today = new Date();
  let slotsCreated = 0;
  for (const master of masterUsers) {
    for (let day = 0; day < 14; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      if (date.getDay() === 0) continue;
      const dateStr = date.toISOString().split('T')[0];
      const numSlots = 3 + Math.floor(Math.random() * 5);
      for (let h = 9; h < 9 + numSlots; h++) {
        const startM = Math.random() > 0.5 ? '00' : '30';
        const start = `${String(h).padStart(2, '0')}:${startM}`;
        const endHour = startM === '00' ? h + 1 : h + 1;
        const end = `${String(endHour).padStart(2, '0')}:${startM === '00' ? '00' : '30'}`;
        await db.insert(schema.schedules).values({
          workDate: dateStr, startTime: start, endTime: end,
          status: Math.random() > 0.3 ? 'available' : 'booked',
          masterId: master.id,
        }).onConflictDoNothing();
        slotsCreated++;
      }
    }
  }
  console.log(`📅 ${slotsCreated} schedule slots`);

  // ═══════════════════════════════════════════════════════
  // 6. ORDERS
  // ═══════════════════════════════════════════════════════

  let ordersCreated = 0;
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  for (let i = 0; i < 25; i++) {
    const client = clientUsers[Math.floor(Math.random() * clientUsers.length)];
    const master = masterUsers[Math.floor(Math.random() * masterUsers.length)];
    const masterSvcs = createdServices.filter((s: { masterId: string }) => s.masterId === master.id);
    if (!masterSvcs.length) continue;
    const svc = masterSvcs[Math.floor(Math.random() * masterSvcs.length)];
    const design = createdDesigns[Math.floor(Math.random() * createdDesigns.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 3600 * 1000));

    const [order] = await db.insert(schema.orders).values({
      description: `Order: $${(svc as { price: string }).price}`,
      status,
      price: (svc as { price: string }).price,
      requestedDateTime: orderDate,
      confirmedDateTime: status === 'confirmed' || status === 'completed' ? orderDate : null,
      completedAt: status === 'completed' ? new Date(orderDate.getTime() + 2 * 3600 * 1000) : null,
      completedBy: status === 'completed' ? 'master' : null,
      rating: status === 'completed' ? 4 + Math.floor(Math.random() * 2) : null,
      clientId: client.id,
      nailMasterId: master.id,
      masterServiceId: (svc as { id: string }).id,
      nailDesignId: design?.id || null,
    }).returning();
    if (order) ordersCreated++;
  }
  console.log(`📋 ${ordersCreated} orders`);

  // ═══════════════════════════════════════════════════════
  // 7. RATINGS
  // ═══════════════════════════════════════════════════════

  const reviewTexts = [
    'Отличный мастер! Очень довольна результатом.',
    'Аккуратная работа, приятная атмосфера.',
    'Дизайн продержался 3 недели! Буду ходить постоянно.',
    'Профессионал своего дела. Рекомендую!',
    'Лучший маникюр в моей жизни. Спасибо!',
    'Внимательная, терпеливая, талантливая. 5+!',
  ];

  let ratingsCreated = 0;
  for (const master of masterUsers) {
    const numReviews = 2 + Math.floor(Math.random() * 4);
    const shuffledClients = [...clientUsers].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(numReviews, shuffledClients.length); i++) {
      await db.insert(schema.masterRatings).values({
        ratingNumber: 4 + Math.floor(Math.random() * 2),
        description: reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
        nailMasterId: master.id,
        clientId: shuffledClients[i].id,
        createdAt: new Date().toISOString().split('T')[0],
      }).onConflictDoNothing();
      ratingsCreated++;
    }
  }

  // Recalculate master ratings
  for (const master of masterUsers) {
    const ratings = await db.select({ r: schema.masterRatings.ratingNumber })
      .from(schema.masterRatings)
      .where(eq(schema.masterRatings.nailMasterId, master.id));
    if (ratings.length > 0) {
      const avg = ratings.reduce((sum, r) => sum + r.r, 0) / ratings.length;
      await db.update(schema.masterProfiles)
        .set({ rating: String(Math.round(avg * 10) / 10), reviewsCount: ratings.length })
        .where(eq(schema.masterProfiles.userId, master.id));
    }
  }
  console.log(`⭐ ${ratingsCreated} ratings`);

  // ═══════════════════════════════════════════════════════
  // 8. DESIGN LIKES
  // ═══════════════════════════════════════════════════════

  let likesCreated = 0;
  for (const client of clientUsers) {
    const liked = [...createdDesigns].sort(() => Math.random() - 0.5).slice(0, 5 + Math.floor(Math.random() * 8));
    for (const design of liked) {
      await db.insert(schema.clientLikedDesigns).values({
        clientId: client.id, nailDesignId: design.id,
      }).onConflictDoNothing();
      likesCreated++;
    }
  }
  console.log(`❤️ ${likesCreated} design likes`);

  // ═══════════════════════════════════════════════════════
  // 9. COMMENTS + COMMENT LIKES
  // ═══════════════════════════════════════════════════════

  const commentTexts = [
    'Какой красивый дизайн! 😍',
    'Хочу такой же на следующую запись!',
    'Это просто произведение искусства 👏',
    'Подскажите, сколько по времени делается?',
    'Очень нежно и элегантно ✨',
    'Идеально для лета! ☀️',
    'Шикарно! Беру на заметку 📌',
    'Класс! А на короткие ногти такой пойдёт?',
    '🔥🔥🔥',
    'Можно такой же, но в других тонах?',
  ];

  let commentsCreated = 0;
  let commentLikesCreated = 0;
  const allUsers = [...clientUsers, ...masterUsers];

  for (const design of createdDesigns.slice(0, 10)) {
    const numComments = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numComments; i++) {
      const author = allUsers[Math.floor(Math.random() * allUsers.length)];
      const [comment] = await db.insert(schema.comments).values({
        text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        authorId: author.id,
        designId: design.id,
      }).returning();
      if (!comment) continue;
      commentsCreated++;

      // Some comments get likes
      const likers = [...allUsers].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 4));
      for (const liker of likers) {
        if (liker.id === author.id) continue;
        await db.insert(schema.commentLikes).values({
          userId: liker.id, commentId: comment.id,
        }).onConflictDoNothing();
        commentLikesCreated++;
      }
      // Update the likesCount on the comment
      if (likers.length > 0) {
        await db.update(schema.comments)
          .set({ likesCount: likers.filter(l => l.id !== author.id).length })
          .where(eq(schema.comments.id, comment.id));
      }
    }
  }
  console.log(`💬 ${commentsCreated} comments, ${commentLikesCreated} comment likes`);

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════

  console.log('\n' + '='.repeat(50));
  console.log('✅ DATABASE SEEDED');
  console.log('='.repeat(50));
  console.log(`   Admin:    1`);
  console.log(`   Masters:  ${masterUsers.length}`);
  console.log(`   Clients:  ${clientUsers.length}`);
  console.log(`   Designs:  ${createdDesigns.length}`);
  console.log(`   Services: ${createdServices.length}`);
  console.log(`   Slots:    ${slotsCreated}`);
  console.log(`   Orders:   ${ordersCreated}`);
  console.log(`   Ratings:  ${ratingsCreated}`);
  console.log(`   Likes:    ${likesCreated}`);
  console.log(`   Comments: ${commentsCreated}`);
  console.log('='.repeat(50));
  console.log('\n🔑 SMS login — code is always: 000000');
  console.log('   +15550000001  Admin');
  console.log('   +15550000101  Анна Петрова (master)');
  console.log('   +15550000102  Елена Соколова (master)');
  console.log('   +15550000201  Елена Иванова (client)');
  console.log('   All masters: +15550000101..+15550000105');
  console.log('   All clients: +15550000201..+15550000204');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  });
