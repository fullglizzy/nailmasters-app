import { db, schema } from '@/lib/db';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Заполнение базы данных...\n');

  // ============================================================
  // 1. ПОЛЬЗОВАТЕЛИ
  // ============================================================
  const adminHash = await hash('Admin123!', 12);
  const [admin] = await db.insert(schema.users).values({
    email: 'admin@nailmasters.com', username: 'admin', password: adminHash, role: 'admin',
  }).onConflictDoNothing().returning();
  if (admin) {
    await db.insert(schema.adminProfiles).values({ userId: admin.id, fullName: 'Администратор', phone: '+79000000000', permissions: ['all'] }).onConflictDoNothing();
    console.log('👑 Админ: admin@nailmasters.com / Admin123!');
  }

  // Мастера
  const masters = [
    { email: 'anna@nailmasters.com', username: 'anna_nails', password: await hash('Master123!', 12), fullName: 'Анна Петрова', phone: '+79001000001', description: 'Топ-мастер маникюра с 7-летним опытом. Специализируюсь на сложных дизайнах, наращивании и укреплении ногтей. Работаю только с премиальными материалами.', experience: '7 лет', city: 'Москва', specialties: ['Маникюр', 'Педикюр', 'Наращивание', 'Дизайн ногтей', 'Укрепление'], startingPrice: '2500', workFormat: ['salon'], sterilization: true, disposableTools: true, latitude: '55.7558', longitude: '37.6173' },
    { email: 'elena@nailmasters.com', username: 'elena_beauty', password: await hash('Master123!', 12), fullName: 'Елена Соколова', phone: '+79001000002', description: 'Мастер маникюра и педикюра. Люблю минимализм и элегантные дизайны. Принимаю в уютном салоне в центре.', experience: '4 года', city: 'Москва', specialties: ['Маникюр', 'Педикюр', 'Дизайн ногтей', 'Shellac'], startingPrice: '1800', workFormat: ['salon', 'home'], sterilization: true, disposableTools: true, latitude: '55.7650', longitude: '37.6050' },
    { email: 'olga@nailmasters.com', username: 'olga_nailart', password: await hash('Master123!', 12), fullName: 'Ольга Иванова', phone: '+79001000003', description: 'Креативный мастер. Обожаю экспериментировать с цветами и текстурами. Создаю уникальные дизайны под ваш образ.', experience: '3 года', city: 'Санкт-Петербург', specialties: ['Маникюр', 'Наращивание', 'Дизайн ногтей', 'Аэрография'], startingPrice: '2000', workFormat: ['salon'], sterilization: true, disposableTools: false, latitude: '59.9343', longitude: '30.3351' },
    { email: 'maria@nailmasters.com', username: 'maria_nails_spb', password: await hash('Master123!', 12), fullName: 'Мария Кузнецова', phone: '+79001000004', description: 'Сертифицированный мастер с международными дипломами. Работаю с любыми типами ногтей. Гарантирую качество и стойкость.', experience: '6 лет', city: 'Санкт-Петербург', specialties: ['Маникюр', 'Педикюр', 'Наращивание', 'Дизайн ногтей', 'Парафинотерапия'], startingPrice: '3000', workFormat: ['salon'], sterilization: true, disposableTools: true, latitude: '59.9386', longitude: '30.3141' },
    { email: 'daria@nailmasters.com', username: 'daria_nails', password: await hash('Master123!', 12), fullName: 'Дарья Морозова', phone: '+79001000005', description: 'Мастер с художественным образованием. Роспись ногтей любой сложности. Портреты, пейзажи, репродукции.', experience: '5 лет', city: 'Казань', specialties: ['Маникюр', 'Дизайн ногтей', 'Роспись', 'Наращивание'], startingPrice: '2200', workFormat: ['home'], sterilization: true, disposableTools: true, latitude: '55.7961', longitude: '49.1064' },
  ];

  const masterUsers = [];
  for (const m of masters) {
    const [user] = await db.insert(schema.users).values({
      email: m.email, username: m.username, password: m.password, role: 'nailmaster',
    }).onConflictDoNothing().returning();
    if (user) {
      masterUsers.push(user);
      await db.insert(schema.masterProfiles).values({
        userId: user.id, fullName: m.fullName, phone: m.phone, description: m.description,
        experience: m.experience, city: m.city, isModerated: true,
        specialties: m.specialties, startingPrice: m.startingPrice, workFormat: m.workFormat,
        sterilization: m.sterilization, disposableTools: m.disposableTools,
        latitude: m.latitude, longitude: m.longitude,
      }).onConflictDoNothing();
      console.log(`💅 Мастер: ${m.fullName} (${m.city})`);
    }
  }

  // Клиенты
  const clientHash = await hash('Client123!', 12);
  const clients = [
    { email: 'client@nailmasters.com', username: 'elena_client', fullName: 'Елена Иванова', phone: '+79002000001', latitude: '55.7539', longitude: '37.6208' },
    { email: 'katya@nailmasters.com', username: 'katya_style', fullName: 'Екатерина Смирнова', phone: '+79002000002', latitude: '55.7580', longitude: '37.6100' },
    { email: 'nastya@nailmasters.com', username: 'nastya_love', fullName: 'Анастасия Волкова', phone: '+79002000003', latitude: '59.9500', longitude: '30.3000' },
    { email: 'sasha@nailmasters.com', username: 'sasha_nails', fullName: 'Александра Попова', phone: '+79002000004', latitude: '55.7900', longitude: '49.1100' },
  ];

  const clientUsers = [];
  for (const c of clients) {
    const [user] = await db.insert(schema.users).values({
      email: c.email, username: c.username, password: clientHash, role: 'client',
    }).onConflictDoNothing().returning();
    if (user) {
      clientUsers.push(user);
      await db.insert(schema.clientProfiles).values({
        userId: user.id, fullName: c.fullName, phone: c.phone,
        latitude: c.latitude, longitude: c.longitude,
      }).onConflictDoNothing();
      console.log(`👤 Клиент: ${c.fullName}`);
    }
  }

  console.log('\n📸 Создание дизайнов...');

  // ============================================================
  // 2. ДИЗАЙНЫ
  // ============================================================
  const designData = [
    { title: 'Нежный френч с цветочным узором', description: 'Классический френч с акварельными цветами на безымянном пальце. Нежные пастельные тона, идеально для весны.', type: 'designer', color: 'Розовый', length: 'medium', shape: 'almond', season: 'spring', techniques: ['Френч', 'Акварель', 'Роспись'], moodTags: ['Нежный', 'Романтичный', 'Весенний'], materials: ['Гель-лак', 'Акриловые краски'], tags: ['френч', 'цветы', 'весна', 'нежный', 'розовый', 'акварель'] },
    { title: 'Мраморный маникюр с золотом', description: 'Эффектный мраморный дизайн с тонкими золотыми линиями. Благородный и стильный вариант для особого случая.', type: 'designer', color: 'Белый', length: 'long', shape: 'stiletto', season: 'winter', techniques: ['Мрамор', 'Фольга'], moodTags: ['Гламур', 'Праздничный', 'Вечерний'], materials: ['Гель', 'Фольга', 'Топовое покрытие'], tags: ['мрамор', 'золото', 'вечерний', 'белый', 'гламур', 'стилет'] },
    { title: 'Яркий летний градиент', description: 'Сочный градиент от оранжевого к розовому с блестками. Поднимает настроение!', type: 'basic', color: 'Оранжевый', length: 'short', shape: 'square', season: 'summer', techniques: ['Градиент', 'Блестки'], moodTags: ['Яркий', 'Летний', 'Повседневный'], materials: ['Гель-лак', 'Блестки'], tags: ['градиент', 'лето', 'яркий', 'оранжевый', 'квадрат'] },
    { title: 'Минимализм: nude + геометрия', description: 'Элегантный nude с тонкими геометрическими линиями. Идеально для офиса и повседневной носки.', type: 'basic', color: 'Нюдовый', length: 'medium', shape: 'soft_square', season: 'fall', techniques: ['Минимализм', 'Геометрия'], moodTags: ['Минимализм', 'Офисный', 'Элегантный'], materials: ['Гель-лак'], tags: ['минимализм', 'nude', 'геометрия', 'офис', 'элегантный'] },
    { title: 'Кошачий глаз с втиркой', description: 'Магнитный гель-лак "кошачий глаз" с жемчужной втиркой. Глубокий переливающийся эффект.', type: 'designer', color: 'Синий', length: 'long', shape: 'almond', season: 'winter', techniques: ['Кошачий глаз', 'Втирка'], moodTags: ['Гламур', 'Вечерний', 'Загадочный'], materials: ['Гель-лак', 'Магнитный гель', 'Втирка'], tags: ['кошачий глаз', 'втирка', 'синий', 'гламур', 'переливы'] },
    { title: 'Свадебный маникюр с кружевом', description: 'Нежнейший свадебный дизайн: белая база, кружевная роспись, стразы Swarovski на безымянном пальце.', type: 'designer', color: 'Белый', length: 'medium', shape: 'oval', season: 'summer', techniques: ['Роспись', 'Стразы', 'Лепка'], moodTags: ['Свадебный', 'Романтичный', 'Нежный'], materials: ['Гель', 'Стразы', 'Акриловая пудра'], tags: ['свадьба', 'кружево', 'стразы', 'белый', 'нежный'] },
    { title: 'Осенний маникюр с листьями', description: 'Теплая осенняя палитра с золотыми листьями. Уютный дизайн для прохладных дней.', type: 'designer', color: 'Красный', length: 'medium', shape: 'almond', season: 'fall', techniques: ['Роспись', 'Фольга', 'Стемпинг'], moodTags: ['Осенний', 'Уютный', 'Повседневный'], materials: ['Гель-лак', 'Фольга', 'Краски'], tags: ['осень', 'листья', 'золото', 'красный', 'уют'] },
    { title: 'Готический черный с хромом', description: 'Дерзкий черный маникюр с хромированными акцентами. Для смелых и стильных.', type: 'designer', color: 'Черный', length: 'long', shape: 'ballerina', season: 'winter', techniques: ['Хром', 'Градиент'], moodTags: ['Дерзкий', 'Вечерний', 'Гламур'], materials: ['Гель', 'Хром', 'Черный гель-лак'], tags: ['черный', 'хром', 'готика', 'дерзкий', 'балерина'] },
    { title: 'Радужный омбре на короткие', description: 'Веселый радужный омбре на коротких ногтях. Каждый ноготь — новый цвет. Позитив гарантирован!', type: 'basic', color: 'Разноцветный', length: 'short', shape: 'square', season: 'summer', techniques: ['Омбре', 'Градиент'], moodTags: ['Яркий', 'Весенний', 'Креативный'], materials: ['Гель-лак'], tags: ['радуга', 'омбре', 'короткие', 'лето', 'цветной'] },
    { title: 'Зимняя сказка со снежинками', description: 'Голубая база с белыми снежинками и серебряными блестками. Новогоднее настроение на ногтях.', type: 'designer', color: 'Голубой', length: 'medium', shape: 'round', season: 'winter', techniques: ['Роспись', 'Блестки', 'Стемпинг'], moodTags: ['Праздничный', 'Зимний', 'Сказочный'], materials: ['Гель-лак', 'Блестки', 'Стемпинг-пластины'], tags: ['зима', 'снежинки', 'новый год', 'голубой', 'праздник'] },
    { title: 'Бордовый бархат с золотом', description: 'Эффект бархата на глубоком бордовом фоне с золотыми полосками. Роскошный вариант для вечера.', type: 'designer', color: 'Бордовый', length: 'long', shape: 'almond', season: 'fall', techniques: ['Бархат', 'Фольга'], moodTags: ['Вечерний', 'Гламур', 'Роскошный'], materials: ['Гель', 'Бархатная пудра', 'Фольга'], tags: ['бархат', 'бордовый', 'золото', 'вечер', 'роскошь'] },
    { title: 'Пастельная геометрия', description: 'Нежные пастельные треугольники и линии на nude-базе. Модный геометричный дизайн.', type: 'basic', color: 'Нюдовый', length: 'medium', shape: 'soft_square', season: 'spring', techniques: ['Геометрия', 'Минимализм'], moodTags: ['Минимализм', 'Нежный', 'Современный'], materials: ['Гель-лак'], tags: ['геометрия', 'пастель', 'минимализм', 'nude', 'модный'] },
    { title: 'Тропические листья монстера', description: 'Зеленые листья монстеры на прозрачной базе. Свежий тропический дизайн для отпуска.', type: 'designer', color: 'Зеленый', length: 'medium', shape: 'oval', season: 'summer', techniques: ['Роспись', 'Слайдер'], moodTags: ['Летний', 'Креативный', 'Яркий'], materials: ['Гель-лак', 'Акриловые краски'], tags: ['тропики', 'листья', 'зеленый', 'лето', 'монстера'] },
    { title: 'Розовый кварц с трещинами', description: 'Имитация розового кварца с тонкими темными прожилками. Натуральный каменный эффект.', type: 'designer', color: 'Розовый', length: 'medium', shape: 'almond', season: 'spring', techniques: ['Мрамор', 'Роспись'], moodTags: ['Нежный', 'Натуральный', 'Элегантный'], materials: ['Гель', 'Краски'], tags: ['кварц', 'розовый', 'камень', 'мрамор', 'натуральный'] },
    { title: 'Красный глянец с негативным пространством', description: 'Ярко-красный лак с геометричными вырезами негативного пространства. Смело и сексуально.', type: 'basic', color: 'Красный', length: 'long', shape: 'stiletto', season: 'summer', techniques: ['Негативное пространство', 'Геометрия'], moodTags: ['Дерзкий', 'Вечерний', 'Страстный'], materials: ['Гель-лак'], tags: ['красный', 'негативное пространство', 'геометрия', 'глянец'] },
  ];

  const createdDesigns = [];
  for (let i = 0; i < designData.length; i++) {
    const d = designData[i];
    const master = masterUsers[i % masterUsers.length];
    const imageNum = (i % 5) + 1;
    const [design] = await db.insert(schema.nailDesigns).values({
      title: d.title, description: d.description,
      images: [`/uploads/designs/image-${i + 1}.jpg`, `/uploads/designs/image-${i + 2}.jpg`],
      type: d.type, source: 'master',
      tags: d.tags, color: d.color, techniques: d.techniques, length: d.length, shape: d.shape,
      season: d.season, moodTags: d.moodTags, materials: d.materials,
      durationMinutes: 60 + Math.floor(Math.random() * 60),
      isModerated: true, likesCount: Math.floor(Math.random() * 200) + 10,
      ordersCount: Math.floor(Math.random() * 30),
      uploadedByMasterId: master?.id,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 3600 * 1000)),
    }).returning();
    if (design) createdDesigns.push(design);
  }
  console.log(`💅 Создано ${createdDesigns.length} дизайнов`);

  // ============================================================
  // 3. УСЛУГИ МАСТЕРОВ
  // ============================================================
  const serviceTemplates = [
    { name: 'Маникюр с покрытием', description: 'Классический маникюр + однотонное гель-лак покрытие', price: '2500', duration: 60 },
    { name: 'Маникюр + дизайн', description: 'Полный маникюр с дизайнерским покрытием', price: '3500', duration: 90 },
    { name: 'Наращивание ногтей', description: 'Моделирование ногтей гелем на формах', price: '4500', duration: 120 },
    { name: 'Экспресс-маникюр', description: 'Быстрый маникюр с однотонным покрытием', price: '1800', duration: 45 },
    { name: 'Педикюр с покрытием', description: 'Полный педикюр + гель-лак покрытие', price: '3000', duration: 75 },
    { name: 'Дизайнерский педикюр', description: 'Педикюр с художественным оформлением', price: '4000', duration: 100 },
    { name: 'Укрепление ногтей', description: 'Укрепление натуральных ногтей акриловой пудрой', price: '1500', duration: 30 },
    { name: 'Снятие + новое покрытие', description: 'Аппаратное снятие старого покрытия + новый маникюр', price: '3200', duration: 90 },
  ];

  const createdServices = [];
  for (const master of masterUsers) {
    const numServices = 3 + Math.floor(Math.random() * 4);
    const shuffled = [...serviceTemplates].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numServices; i++) {
      const t = shuffled[i];
      const [svc] = await db.insert(schema.masterServices).values({
        name: t.name, description: t.description, price: t.price, duration: t.duration,
        masterId: master.id,
      }).returning();
      if (svc) createdServices.push(svc);
    }
  }
  console.log(`🔧 Создано ${createdServices.length} услуг`);

  // Привязка дизайнов к услугам
  let linkedDesigns = 0;
  for (const design of createdDesigns) {
    const masterId = design.uploadedByMasterId;
    if (!masterId) continue;
    const masterServices = createdServices.filter(s => {
      const svc = s as { masterId: string };
      return svc.masterId === masterId;
    });
    if (masterServices.length > 0 && Math.random() > 0.3) {
      const svc = masterServices[Math.floor(Math.random() * masterServices.length)] as { id: string };
      await db.insert(schema.masterServiceDesigns).values({
        masterServiceId: svc.id,
        nailDesignId: design.id,
        customPrice: String(Math.floor(Math.random() * 1000) + 500),
        additionalDuration: Math.floor(Math.random() * 30),
      }).onConflictDoNothing();
      linkedDesigns++;
    }
  }
  console.log(`🔗 ${linkedDesigns} дизайнов привязано к услугам`);

  // ============================================================
  // 4. РАСПИСАНИЕ
  // ============================================================
  const today = new Date();
  let slotsCreated = 0;
  for (const master of masterUsers) {
    for (let day = 0; day < 14; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      // Пропускаем воскресенье
      if (date.getDay() === 0) continue;
      const dateStr = date.toISOString().split('T')[0];

      const numSlots = 3 + Math.floor(Math.random() * 5);
      for (let h = 9; h < 9 + numSlots; h++) {
        const startH = h;
        const startM = Math.random() > 0.5 ? '00' : '30';
        const endH = startM === '00' ? startH + 1 : startH + 1;
        const endM = startM === '00' ? '00' : '30';

        await db.insert(schema.schedules).values({
          workDate: dateStr,
          startTime: `${String(startH).padStart(2, '0')}:${startM}`,
          endTime: `${String(endH).padStart(2, '0')}:${endM}`,
          status: Math.random() > 0.3 ? 'available' : 'booked',
          masterId: master.id,
        }).onConflictDoNothing();
        slotsCreated++;
      }
    }
  }
  console.log(`📅 Создано ${slotsCreated} слотов расписания`);

  // ============================================================
  // 5. ЗАКАЗЫ
  // ============================================================
  let ordersCreated = 0;
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  for (let i = 0; i < 25; i++) {
    const client = clientUsers[Math.floor(Math.random() * clientUsers.length)];
    const master = masterUsers[Math.floor(Math.random() * masterUsers.length)];
    const masterSvc = createdServices.filter((s: { masterId: string }) => s.masterId === master.id);
    if (!masterSvc.length) continue;

    const svc = masterSvc[Math.floor(Math.random() * masterSvc.length)] as { id: string; price: string; duration: number };
    const design = createdDesigns[Math.floor(Math.random() * createdDesigns.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 3600 * 1000));

    const [order] = await db.insert(schema.orders).values({
      description: `Заказ: ${svc.price} ₽`,
      status,
      price: svc.price,
      requestedDateTime: orderDate,
      confirmedDateTime: status === 'confirmed' || status === 'completed' ? orderDate : null,
      completedAt: status === 'completed' ? new Date(orderDate.getTime() + 2 * 3600 * 1000) : null,
      completedBy: status === 'completed' ? 'master' : null,
      rating: status === 'completed' ? 4 + Math.floor(Math.random() * 2) : null,
      clientId: client.id,
      nailMasterId: master.id,
      masterServiceId: svc.id,
      nailDesignId: design?.id || null,
    }).returning();
    if (order) ordersCreated++;
  }
  console.log(`📋 Создано ${ordersCreated} заказов`);

  // ============================================================
  // 6. РЕЙТИНГИ И ОТЗЫВЫ
  // ============================================================
  let ratingsCreated = 0;
  const reviewTexts = [
    'Отличный мастер! Очень довольна результатом.',
    'Аккуратная работа, приятная атмосфера в салоне.',
    'Дизайн продержался 3 недели! Буду ходить постоянно.',
    'Профессионал своего дела. Рекомендую!',
    'Лучший маникюр в моей жизни. Спасибо!',
    'Внимательная, терпеливая, талантливая. 5+!',
    'Хороший мастер, но цена высоковата.',
    'Красивый дизайн, но запись была с задержкой.',
  ];

  for (const master of masterUsers) {
    const numReviews = 2 + Math.floor(Math.random() * 4);
    const shuffledClients = [...clientUsers].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(numReviews, shuffledClients.length); i++) {
      const ratingNum = 4 + Math.floor(Math.random() * 2); // 4-5 звезды
      await db.insert(schema.masterRatings).values({
        ratingNumber: ratingNum,
        description: reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
        nailMasterId: master.id,
        clientId: shuffledClients[i].id,
        createdAt: new Date().toISOString().split('T')[0],
      }).onConflictDoNothing();
      ratingsCreated++;
    }
  }

  // Пересчет рейтинга
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
  console.log(`⭐ Создано ${ratingsCreated} оценок мастеров`);

  // Лайки от клиентов к дизайнам
  let likesCreated = 0;
  for (const client of clientUsers) {
    const likedDesigns = [...createdDesigns].sort(() => Math.random() - 0.5).slice(0, 5 + Math.floor(Math.random() * 8));
    for (const design of likedDesigns) {
      await db.insert(schema.clientLikedDesigns).values({
        clientId: client.id, nailDesignId: design.id,
      }).onConflictDoNothing();
      likesCreated++;
    }
  }
  console.log(`❤️ Создано ${likesCreated} лайков`);

  // ============================================================
  // 7. КОММЕНТАРИИ
  // ============================================================
  const commentTexts = [
    'Какой красивый дизайн! 😍', 'Хочу такой же на следующую запись!',
    'Это просто произведение искусства', 'Подскажите, сколько по времени делается?',
    'Очень нежно и элегантно', 'Идеально для лета!',
    'Можно такой же, но в синих тонах?', 'Шикарно! Беру на заметку.',
    'Класс! А на короткие ногти такой пойдет?', '🔥🔥🔥',
  ];

  let commentsCreated = 0;
  for (const design of createdDesigns.slice(0, 10)) {
    const numComments = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numComments; i++) {
      const author = [...clientUsers, ...masterUsers][Math.floor(Math.random() * (clientUsers.length + masterUsers.length))];
      await db.insert(schema.comments).values({
        text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        authorId: author.id,
        designId: design.id,
      });
      commentsCreated++;
    }
  }
  console.log(`💬 Создано ${commentsCreated} комментариев`);

  // ============================================================
  // ИТОГО
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('✅ БАЗА ДАННЫХ ЗАПОЛНЕНА!');
  console.log('='.repeat(50));
  console.log(`   👑 Администраторы: 1`);
  console.log(`   💅 Мастера: ${masterUsers.length}`);
  console.log(`   👤 Клиенты: ${clientUsers.length}`);
  console.log(`   💅 Дизайны: ${createdDesigns.length}`);
  console.log(`   🔧 Услуги: ${createdServices.length}`);
  console.log(`   📅 Слоты расписания: ${slotsCreated}`);
  console.log(`   📋 Заказы: ${ordersCreated}`);
  console.log(`   ⭐ Оценки: ${ratingsCreated}`);
  console.log(`   ❤️ Лайки: ${likesCreated}`);
  console.log(`   💬 Комментарии: ${commentsCreated}`);
  console.log('='.repeat(50));
  console.log('\n🔑 Учетные данные для входа:');
  console.log('   admin@nailmasters.com  / Admin123!  (администратор)');
  console.log('   anna@nailmasters.com   / Master123! (мастер)');
  console.log('   client@nailmasters.com / Client123! (клиент)');
  console.log(`   Пароль для всех мастеров: Master123!`);
  console.log(`   Пароль для всех клиентов: Client123!`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  });
