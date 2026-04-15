import { PrismaClient, Gender, LookingFor } from '@prisma/client';

const prisma = new PrismaClient();

// ── Sample MP4s (Google GTV — Creative Commons) ───────────────────────────────
const V = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
];

// ── Test profiles — covers all lookingFor, all genders, edge cases ────────────
const TEST_USERS = [
  // ── 1. Sofia — RELATIONSHIP, Female, 27, verified, 1 video ──────────────────
  {
    firebaseUid: 'test_user_1',
    email: 'sofia@checkmate.test',
    firstName: 'Sofia',
    lastName: 'Marchetti',
    dateOfBirth: new Date('1997-03-14'),
    gender: Gender.FEMALE,
    location: 'New York, NY',
    bio: "Architecture grad who spends weekends sketching skylines and hunting down the city's best espresso. Looking for someone to explore hidden rooftop bars with.",
    occupation: 'Architect',
    education: 'Columbia University',
    height: 168,
    profilePictures: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80',
    ],
    profileVideos: [V[0]],
    profileVideo: V[0],
    interests: ['Architecture', 'Coffee', 'Travel', 'Photography', 'Art'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 25,
    ageRangeMax: 38,
    maxDistance: 40,
    lat: 40.7128, lng: -74.006,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 2. James — RELATIONSHIP, Male, 31, verified, 1 video ────────────────────
  {
    firebaseUid: 'test_user_2',
    email: 'james@checkmate.test',
    firstName: 'James',
    lastName: 'Okafor',
    dateOfBirth: new Date('1993-07-22'),
    gender: Gender.MALE,
    location: 'Brooklyn, NY',
    bio: "Chef by day, vinyl collector by night. I'll cook you the best jollof rice you've ever had. Also: hiking enthusiast and surprisingly good at chess.",
    occupation: 'Executive Chef',
    education: 'Culinary Institute of America',
    height: 185,
    profilePictures: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80',
    ],
    profileVideos: [V[1]],
    profileVideo: V[1],
    interests: ['Cooking', 'Music', 'Hiking', 'Food', 'Travel'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 24,
    ageRangeMax: 36,
    maxDistance: 50,
    lat: 40.6782, lng: -73.9442,
    isVerified: true, isActive: true, isPremium: true,
  },

  // ── 3. Luna — CASUAL, Female, 25, unverified, 1 video ───────────────────────
  {
    firebaseUid: 'test_user_3',
    email: 'luna@checkmate.test',
    firstName: 'Luna',
    lastName: 'Reyes',
    dateOfBirth: new Date('1999-11-05'),
    gender: Gender.FEMALE,
    location: 'Manhattan, NY',
    bio: 'Yoga instructor & part-time ceramics artist. My apartment smells like sage and has too many plants. Looking for someone who can keep up on trail runs and slow down on Sundays.',
    occupation: 'Yoga Instructor',
    education: 'NYU',
    height: 163,
    profilePictures: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80',
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80',
    ],
    profileVideos: [V[2]],
    profileVideo: V[2],
    interests: ['Yoga', 'Running', 'Art', 'Meditation', 'Dogs'],
    lookingFor: LookingFor.CASUAL,
    ageRangeMin: 22,
    ageRangeMax: 35,
    maxDistance: 30,
    lat: 40.7831, lng: -73.9712,
    isVerified: false, isActive: true, isPremium: false,
  },

  // ── 4. Marcus — RELATIONSHIP, Male, 33, verified, 1 video ───────────────────
  {
    firebaseUid: 'test_user_4',
    email: 'marcus@checkmate.test',
    firstName: 'Marcus',
    lastName: 'Chen',
    dateOfBirth: new Date('1991-02-18'),
    gender: Gender.MALE,
    location: 'Hoboken, NJ',
    bio: "VC by week, surfer by weekend. Fluent in Python, Spanish, and sarcasm. Trying to get better at sitting still — haven't figured it out yet.",
    occupation: 'Venture Capitalist',
    education: 'Wharton School',
    height: 180,
    profilePictures: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80',
      'https://images.unsplash.com/photo-1463453091185-61582044d556?w=600&q=80',
    ],
    profileVideos: [V[3]],
    profileVideo: V[3],
    interests: ['Surfing', 'Tech', 'Travel', 'Coffee', 'Languages'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 25,
    ageRangeMax: 40,
    maxDistance: 60,
    lat: 40.744, lng: -74.0324,
    isVerified: true, isActive: true, isPremium: true,
  },

  // ── 5. Priya — RELATIONSHIP, Female, 26, verified, 2 videos (tests library) ─
  {
    firebaseUid: 'test_user_5',
    email: 'priya@checkmate.test',
    firstName: 'Priya',
    lastName: 'Sharma',
    dateOfBirth: new Date('1998-08-29'),
    gender: Gender.FEMALE,
    location: 'Astoria, Queens, NY',
    bio: 'Data scientist who moonlights as a Bollywood dance instructor. Equal parts spreadsheets and sequins. I speak in data but dream in choreography.',
    occupation: 'Data Scientist',
    education: 'Cornell University',
    height: 161,
    profilePictures: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
    ],
    profileVideos: [V[4], V[0]],  // 2 videos — active is first
    profileVideo: V[4],
    interests: ['Dancing', 'Tech', 'Fitness', 'Cooking', 'Travel'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 26,
    ageRangeMax: 38,
    maxDistance: 35,
    lat: 40.7721, lng: -73.9302,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 6. Derek — FRIENDSHIP, Male, 38, unverified, NO VIDEO (edge case) ────────
  {
    firebaseUid: 'test_user_6',
    email: 'derek@checkmate.test',
    firstName: 'Derek',
    lastName: 'Foster',
    dateOfBirth: new Date('1986-01-11'),
    gender: Gender.MALE,
    location: 'Bronx, NY',
    bio: 'High school history teacher and weekend D&D dungeon master. Not looking for romance right now — just solid people to grab beers with and argue about movies.',
    occupation: 'Teacher',
    education: 'SUNY Stony Brook',
    height: 178,
    profilePictures: [
      'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=600&q=80',
    ],
    profileVideos: [],        // ← no videos — tests empty-video edge case
    profileVideo: null as any,
    interests: ['Gaming', 'Movies', 'Reading', 'Sports', 'Hiking'],
    lookingFor: LookingFor.FRIENDSHIP,
    ageRangeMin: 28,
    ageRangeMax: 45,
    maxDistance: 25,
    lat: 40.8448, lng: -73.8648,
    isVerified: false, isActive: true, isPremium: false,
  },

  // ── 7. Sam — NETWORKING, Non-binary, 31, verified, 1 video ──────────────────
  {
    firebaseUid: 'test_user_7',
    email: 'sam@checkmate.test',
    firstName: 'Sam',
    lastName: 'Rivera',
    dateOfBirth: new Date('1993-05-03'),
    gender: Gender.NON_BINARY,
    location: 'Long Island City, NY',
    bio: 'UX designer + startup founder. Obsessed with design systems, oat milk lattes, and finding undiscovered musicians. Open to collaborators, mentors, and interesting humans.',
    occupation: 'UX Designer / Founder',
    education: 'Parsons School of Design',
    height: 170,
    profilePictures: [
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&q=80',
    ],
    profileVideos: [V[5]],
    profileVideo: V[5],
    interests: ['Tech', 'Design', 'Music', 'Photography', 'Coffee'],
    lookingFor: LookingFor.NETWORKING,
    ageRangeMin: 25,
    ageRangeMax: 42,
    maxDistance: 45,
    lat: 40.7447, lng: -73.9485,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 8. Aisha — CASUAL, Female, 27, verified, 2 videos (2nd is active) ────────
  {
    firebaseUid: 'test_user_8',
    email: 'aisha@checkmate.test',
    firstName: 'Aisha',
    lastName: 'Williams',
    dateOfBirth: new Date('1997-12-17'),
    gender: Gender.FEMALE,
    location: 'Harlem, NY',
    bio: "Journalist covering arts & culture. If I'm not at a gallery opening, I'm at a jazz basement. My love language is sharing playlists and splitting a good bottle.",
    occupation: 'Journalist',
    education: 'Howard University',
    height: 172,
    profilePictures: [
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&q=80',
    ],
    profileVideos: [V[1], V[6]],  // 2 videos — active is second (tests non-default active)
    profileVideo: V[6],
    interests: ['Music', 'Art', 'Reading', 'Food', 'Wine'],
    lookingFor: LookingFor.CASUAL,
    ageRangeMin: 23,
    ageRangeMax: 36,
    maxDistance: 20,
    lat: 40.8116, lng: -73.9465,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 9. Tyler — CASUAL, Male, 25, unverified, 1 video ────────────────────────
  {
    firebaseUid: 'test_user_9',
    email: 'tyler@checkmate.test',
    firstName: 'Tyler',
    lastName: 'Brooks',
    dateOfBirth: new Date('1999-04-06'),
    gender: Gender.MALE,
    location: 'Jersey City, NJ',
    bio: 'Personal trainer and amateur boxer. Love beach volleyball, anime, and really terrible horror movies. No drama. Just good vibes.',
    occupation: 'Personal Trainer',
    education: 'Rutgers University',
    height: 188,
    profilePictures: [
      'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=600&q=80',
    ],
    profileVideos: [V[7]],
    profileVideo: V[7],
    interests: ['Fitness', 'Sports', 'Gaming', 'Movies', 'Cycling'],
    lookingFor: LookingFor.CASUAL,
    ageRangeMin: 20,
    ageRangeMax: 32,
    maxDistance: 40,
    lat: 40.7178, lng: -74.0431,
    isVerified: false, isActive: true, isPremium: false,
  },

  // ── 10. Naomi — NETWORKING, Female, 33, premium + verified, 1 video ──────────
  {
    firebaseUid: 'test_user_10',
    email: 'naomi@checkmate.test',
    firstName: 'Naomi',
    lastName: 'Park',
    dateOfBirth: new Date('1991-09-24'),
    gender: Gender.FEMALE,
    location: 'Midtown, New York, NY',
    bio: 'Brand strategist for Fortune 500s. I help companies tell better stories, and I enjoy doing the same in my personal life. Looking to build a real network in NYC.',
    occupation: 'Brand Strategist',
    education: 'Georgetown University',
    height: 165,
    profilePictures: [
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80',
    ],
    profileVideos: [V[8]],
    profileVideo: V[8],
    interests: ['Fashion', 'Travel', 'Wine', 'Yoga', 'Art'],
    lookingFor: LookingFor.NETWORKING,
    ageRangeMin: 28,
    ageRangeMax: 45,
    maxDistance: 30,
    lat: 40.7549, lng: -73.984,
    isVerified: true, isActive: true, isPremium: true,
  },

  // ── 11. Carlos — RELATIONSHIP, Male, 29, verified, 1 video ──────────────────
  {
    firebaseUid: 'test_user_11',
    email: 'carlos@checkmate.test',
    firstName: 'Carlos',
    lastName: 'Mendez',
    dateOfBirth: new Date('1995-06-12'),
    gender: Gender.MALE,
    location: 'Washington Heights, NY',
    bio: 'Muralist & graphic novelist. I split my time between my studio and the corner spot where the old guys play dominoes. My mom says I need to meet more people.',
    occupation: 'Artist',
    education: 'School of Visual Arts',
    height: 177,
    profilePictures: [
      'https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=600&q=80',
    ],
    profileVideos: [V[2]],
    profileVideo: V[2],
    interests: ['Art', 'Photography', 'Music', 'Travel', 'Food'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 22,
    ageRangeMax: 35,
    maxDistance: 25,
    lat: 40.8411, lng: -73.9393,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 12. Zoey — CASUAL, Female, 22, unverified, NO video, minimal bio ─────────
  {
    firebaseUid: 'test_user_12',
    email: 'zoey@checkmate.test',
    firstName: 'Zoey',
    lastName: 'Hart',
    dateOfBirth: new Date('2002-02-14'),
    gender: Gender.FEMALE,
    location: 'Staten Island, NY',
    bio: '', // empty bio — tests missing bio edge case
    occupation: undefined,
    education: undefined,
    height: undefined,
    profilePictures: [
      'https://images.unsplash.com/photo-1502767089025-6572583495b9?w=600&q=80',
    ],
    profileVideos: [],        // no videos — second no-video edge case
    profileVideo: null as any,
    interests: ['Music', 'Coffee'],   // minimal interests
    lookingFor: LookingFor.CASUAL,
    ageRangeMin: 18,
    ageRangeMax: 30,
    maxDistance: 50,
    lat: 40.5795, lng: -74.1502,
    isVerified: false, isActive: true, isPremium: false,
  },

  // ── 13. David — FRIENDSHIP, Male, 35, verified, 1 video ─────────────────────
  {
    firebaseUid: 'test_user_13',
    email: 'david@checkmate.test',
    firstName: 'David',
    lastName: 'Kim',
    dateOfBirth: new Date('1989-10-30'),
    gender: Gender.MALE,
    location: 'Flushing, Queens, NY',
    bio: 'Software engineer at a FAANG. I am aggressively mediocre at golf, very good at board games, and still speedrunning Hollow Knight. Just want some non-work friends, honestly.',
    occupation: 'Software Engineer',
    education: 'Carnegie Mellon University',
    height: 174,
    profilePictures: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80',
    ],
    profileVideos: [V[0]],
    profileVideo: V[0],
    interests: ['Gaming', 'Tech', 'Cycling', 'Coffee', 'Reading'],
    lookingFor: LookingFor.FRIENDSHIP,
    ageRangeMin: 25,
    ageRangeMax: 45,
    maxDistance: 35,
    lat: 40.7675, lng: -73.833,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 14. Isabelle — RELATIONSHIP, Female, 28, premium + verified, 3 videos ───
  {
    firebaseUid: 'test_user_14',
    email: 'isabelle@checkmate.test',
    firstName: 'Isabelle',
    lastName: 'Dupont',
    dateOfBirth: new Date('1996-07-08'),
    gender: Gender.FEMALE,
    location: 'Fort Lee, NJ',
    bio: 'Half-French, half-Haitian, fully chaotic. I work in sustainable fashion and spend money I probably shouldn\'t on restaurant tasting menus. 10/10 travel companion, you\'d keep me.',
    occupation: 'Fashion Editor',
    education: 'Parsons + Sciences Po Paris',
    height: 169,
    profilePictures: [
      'https://images.unsplash.com/photo-1524638067-46ed06cd9ecf?w=600&q=80',
    ],
    profileVideos: [V[3], V[5], V[8]],  // 3 videos — tests rich library
    profileVideo: V[5],                  // active is the middle one
    interests: ['Fashion', 'Food', 'Travel', 'Wine', 'Art'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 26,
    ageRangeMax: 40,
    maxDistance: 50,
    lat: 40.8509, lng: -73.9701,
    isVerified: true, isActive: true, isPremium: true,
  },

  // ── 15. Malik — RELATIONSHIP, Male, 32, verified, 1 video ───────────────────
  {
    firebaseUid: 'test_user_15',
    email: 'malik@checkmate.test',
    firstName: 'Malik',
    lastName: 'Johnson',
    dateOfBirth: new Date('1992-03-22'),
    gender: Gender.MALE,
    location: 'Crown Heights, Brooklyn, NY',
    bio: 'Music producer and semi-professional sneakerhead. I have a studio in my apartment and a problem buying limited releases. Looking for someone to build with, not just date.',
    occupation: 'Music Producer',
    education: 'Berklee College of Music',
    height: 183,
    profilePictures: [
      'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?w=600&q=80',
    ],
    profileVideos: [V[4]],
    profileVideo: V[4],
    interests: ['Music', 'Fashion', 'Fitness', 'Food', 'Travel'],
    lookingFor: LookingFor.RELATIONSHIP,
    ageRangeMin: 24,
    ageRangeMax: 38,
    maxDistance: 40,
    lat: 40.6694, lng: -73.9444,
    isVerified: true, isActive: true, isPremium: false,
  },

  // ── 16. Reina — CASUAL, Female, 25, verified, 2 videos ──────────────────────
  {
    firebaseUid: 'test_user_16',
    email: 'reina@checkmate.test',
    firstName: 'Reina',
    lastName: 'Nakamura',
    dateOfBirth: new Date('1999-01-19'),
    gender: Gender.FEMALE,
    location: 'Williamsburg, Brooklyn, NY',
    bio: 'Film photographer, zine maker, and amateur sushi chef. I am annoyingly punctual, always have a book in my bag, and will absolutely judge your shoe game.',
    occupation: 'Graphic Designer',
    education: 'Rhode Island School of Design',
    height: 158,
    profilePictures: [
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80',
    ],
    profileVideos: [V[6], V[1]],
    profileVideo: V[6],
    interests: ['Photography', 'Art', 'Coffee', 'Reading', 'Cats'],
    lookingFor: LookingFor.CASUAL,
    ageRangeMin: 22,
    ageRangeMax: 33,
    maxDistance: 20,
    lat: 40.7135, lng: -73.9566,
    isVerified: true, isActive: true, isPremium: false,
  },
];

// ── Demo user ─────────────────────────────────────────────────────────────────
const DEMO_USER = {
  firebaseUid: 'demo_user',
  email: 'demo@checkmate.app',
  firstName: 'Alex',
  lastName: 'Demo',
  dateOfBirth: new Date('1995-06-15'),
  gender: Gender.MALE,
  location: 'New York, NY',
  bio: 'This is the demo account used for local development.',
  occupation: 'Software Engineer',
  education: 'MIT',
  height: 178,
  profilePictures: [
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=80',
  ],
  profileVideos: [] as string[],
  interests: ['Tech', 'Coffee', 'Travel', 'Music', 'Fitness'],
  lookingFor: LookingFor.RELATIONSHIP,
  ageRangeMin: 22,
  ageRangeMax: 38,
  maxDistance: 50,
  lat: 40.7128,
  lng: -74.006,
  isVerified: true,
  isActive: true,
  isPremium: false,
};

async function main() {
  console.log('🌱 Seeding...\n');

  // 1. Demo user first
  const demo = await prisma.user.upsert({
    where: { firebaseUid: DEMO_USER.firebaseUid },
    update: { isActive: true, lastActive: new Date() },
    create: DEMO_USER,
  });
  console.log(`  ✓ [demo_user]     ${demo.firstName} ${demo.lastName} (${demo.email})`);

  // 2. All test profiles
  for (const data of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { firebaseUid: data.firebaseUid },
      update: {
        profileVideo: data.profileVideo ?? null,
        profileVideos: data.profileVideos,
        profilePictures: data.profilePictures,
        bio: data.bio,
        occupation: data.occupation ?? null,
        education: data.education ?? null,
        height: data.height ?? null,
        interests: data.interests,
        lookingFor: data.lookingFor,
        isVerified: data.isVerified,
        isPremium: data.isPremium,
        isActive: true,
        lastActive: new Date(Date.now() - Math.random() * 3_600_000 * 48), // random last-active within 48h
      },
      create: data,
    });

    const videoCount = data.profileVideos.length;
    const flags = [
      data.isVerified ? '✓verified' : '–unverified',
      data.isPremium ? '★premium' : '',
      videoCount === 0 ? '⚠ no video' : `${videoCount} video${videoCount > 1 ? 's' : ''}`,
      data.gender === Gender.NON_BINARY ? 'non-binary' : '',
    ].filter(Boolean).join(' · ');

    console.log(
      `  ✓ [${data.firebaseUid.padEnd(14)}]  ` +
      `${(user.firstName + ' ' + user.lastName).padEnd(20)}` +
      `${LookingFor[data.lookingFor].padEnd(14)}  ${flags}`
    );
  }

  // 3. Pre-seed reciprocal likes: these 6 users already "liked" demo_user.
  //    When demo_user likes them back the real /matches/like endpoint finds the
  //    mutual like and fires a real Match — no frontend randomness needed.
  const AUTO_LIKERS = [
    { uid: 'test_user_1',  isSuper: false },  // Sofia
    { uid: 'test_user_2',  isSuper: true  },  // James  (super like)
    { uid: 'test_user_5',  isSuper: false },  // Priya
    { uid: 'test_user_8',  isSuper: false },  // Aisha
    { uid: 'test_user_14', isSuper: true  },  // Isabelle (super like)
    { uid: 'test_user_15', isSuper: false },  // Malik
  ];

  let autoLikeCount = 0;
  for (const { uid, isSuper } of AUTO_LIKERS) {
    const liker = await prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (liker) {
      await prisma.like.upsert({
        where: { senderId_receiverId: { senderId: liker.id, receiverId: demo.id } },
        update: { isSuper },
        create: { senderId: liker.id, receiverId: demo.id, isSuper },
      });
      autoLikeCount++;
    }
  }
  console.log(`\n  ✓ ${autoLikeCount} pre-seeded reciprocal like(s) → demo_user`);
  console.log('    (Like Sofia / James / Priya / Aisha / Isabelle / Malik to trigger a real match)');

  // 4. Clear stale likes FROM demo_user so all profiles appear in feed
  const deleted = await prisma.like.deleteMany({ where: { senderId: demo.id } });
  if (deleted.count > 0) {
    console.log(`\n  ↺ Cleared ${deleted.count} stale like(s) from demo_user`);
  }

  console.log(`\n✅ Seed complete — demo + ${TEST_USERS.length} test profiles ready.\n`);
  console.log('Coverage:');
  console.log('  lookingFor   RELATIONSHIP ×8, CASUAL ×4, FRIENDSHIP ×2, NETWORKING ×2');
  console.log('  gender       FEMALE ×8, MALE ×7, NON_BINARY ×1');
  console.log('  verified     verified ×12, unverified ×4');
  console.log('  premium      premium ×4, free ×12');
  console.log('  videos       3 videos ×1, 2 videos ×4, 1 video ×9, no video ×2 (edge cases)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
