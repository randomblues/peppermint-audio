export const hirePricing = {
  additionalNightRate: 0.5,
  summary: "Standard rate for the first night. Every additional night half price.",
  cartSummary: "Hiring for multiple nights? Every extra night is 50% off the standard nightly rate.",
  details: "Applies to all packages and individual equipment. Nights are counted between pickup and return dates, with a one-night minimum for same-day hires. Pickup and return times are agreed separately.",
};

export type PackageTier = {
  slug: string;
  name: string;
  price: number;
  capacity: string;
  summary: string;
  bestFor: string;
  inclusions: string[];
  addOnSlugs: string[];
  notes?: string;
  image: string;
};

type AddOn = {
  name: string;
  price: number;
  popular?: boolean;
  description: string;
  details: string[];
  category?: "DI boxes" | "Lighting" | "Microphones" | "Mixers" | "Accessories";
  image?: string;
  imageSize?: "compact";
};

export type EquipmentOption = {
  label: string;
  price: number;
};

export type EquipmentItem = {
  slug: string;
  name: string;
  category: string;
  popular?: boolean;
  description: string;
  image?: string;
  imageSize?: "compact";
  options: EquipmentOption[];
  details: string[];
};

export const customerReviews = [
  {
    reviewer: "Stan Nicholson",
    text: "Hired some gear for a house party off just a few days notice, the sound system was a great price. Shane was responsive and accommodating. Would highly recommend.",
  },
  {
    reviewer: "Nathan Johnson",
    text: "Good service provided heavily recommend",
  },
  {
    reviewer: "AL",
    text: "Was able to get last minute speaker hire for an absolute bargain with top notch service and quality. Definitely recommend Shane for your sound system needs.",
  },
  {
    reviewer: "Stanley Nguyen",
    text: "Good service provided and very easy to set up.",
  },
  {
    reviewer: "Harry S",
    text: "Top tier service provided. Very much recommend hiring from peppermint mint audio for affordable rates.",
  },
  {
    reviewer: "kavin Maran",
    text: "Thanks to Peppermint Audio for providing excellent speakers and being extremely punctual really appreciated the professional service!",
  },
  {
    reviewer: "Amir H",
    text: "Shane is a legend. Honest, punctual, and made the process super easy. Highly recommended. I would definitely return for future events.",
  },
  {
    reviewer: "Joe Franklin Genesis Lumintang",
    text: "Great service, reliable, trustworthy",
  },
  {
    reviewer: "Dennis Katsoulakos",
    text: "Hired the audio equipment from Shane, great service, great equipment. Thanks Shane.",
  },
  {
    reviewer: "Christina Cravens",
    text: "Honestly the best in business. Very affordable rates and reliable service provided for my event.",
  },
] as const;

export const addOnCatalog: Record<string, AddOn> = {
  "party-lights-bar": {
    name: "CR Lite MagikBar Hub Party Bar",
    price: 30,
    popular: true,
    description: "Multi-effect lighting bar for dance floors, DJs, and parties.",
    details: [
      "Multiple party lighting effects on one bar",
      "Colour washes and patterned effects for dance floors",
    ],
    category: "Lighting",
    image: "/cr-lite-magikbar.avif",
  },
  "wireless-microphones": {
    name: "Wireless Microphone Upgrade",
    price: 20,
    description: "Wireless microphone upgrade for speeches, toasts, and moving around the venue.",
    details: [
      "Wireless handheld microphone",
      "Receiver connects to your mixer or PA speaker",
      "Cable-free movement for speeches and performances",
    ],
    category: "Microphones",
  },
  "di-box": {
    name: "Pro DI Box",
    price: 15,
    popular: true,
    description: "Passive direct box for connecting instruments to a mixer with a balanced, isolated signal.",
    details: [
      "Passive DI; no external power required",
      "Transformer-isolated balanced XLR output",
      "15dB pad and ground-lift controls",
    ],
    category: "DI boxes",
    image: "/pro-di-box.webp",
  },
  "generic-di-box": {
    name: "Generic DI Box",
    price: 10,
    description: "Direct box for connecting an instrument signal to the balanced microphone input of a mixer.",
    details: [
      "Instrument input with a link-through connection",
      "Balanced XLR output to your mixer",
      "Ground-lift switch to help reduce ground-loop hum",
    ],
    category: "DI boxes",
    image: "/generic-di-box.jpg",
  },
  "four-channel-di-box": {
    name: "4-Channel DI Box",
    price: 20,
    description: "Four-channel direct box for connecting keyboards, instruments, and other audio sources to a mixer.",
    details: [
      "Four independent DI channels",
      "Balanced XLR outputs for each channel",
      "Individual ground-lift and 20dB pad switches",
    ],
    category: "DI boxes",
    image: "/dbx-di4.jpg",
    imageSize: "compact",
  },
  "spirit-e12-mixer": {
    name: "Spirit E12 / 12-Channel Soundcraft Mixer Upgrade",
    price: 30,
    description: "Analogue mixer for bands, speeches, and events with several microphones or instruments.",
    details: [
      "12 mono mic/line inputs plus two stereo inputs",
      "3-band EQ with swept midrange",
      "Two aux sends for monitors or external effects",
    ],
    category: "Mixers",
    image: "/soundcraft-spirit-e12.jpg",
  },
  "behringer-x32": {
    name: "Behringer X32 Digital Mixer Upgrade",
    price: 110,
    description: "Digital mixing console for live bands, larger events, and multi-microphone setups.",
    details: [
      "32 microphone preamps and 16 mix buses",
      "Motorised faders with scene recall",
      "Built-in effects and channel processing",
    ],
    category: "Mixers",
    image: "/behringer-x32.jpg",
  },
  "party-light-par-can": {
    name: "Party Light PAR Can",
    price: 10,
    description: "LED PAR light for adding a colour wash to walls, backdrops, and small stages.",
    details: [
      "LED PAR fixture for wash lighting",
      "Lights walls, backdrops, and performance areas",
      "Adjustable bracket for aiming the light",
    ],
    category: "Lighting",
    image: "/par-can-generic.jpg",
  },
  "extension-reel-10m": {
    name: "10m Extension Reel",
    price: 10,
    description: "Extension lead on a reel for reaching mains power further from your event setup.",
    details: [
      "10m cable length",
      "Reel design for neat cable storage and transport",
    ],
    category: "Accessories",
    image: "/10m-extension-reel.jpeg",
  },
};

export const equipmentCatalog: EquipmentItem[] = [
  {
    slug: "bose-s1-pro",
    name: "Bose S1 Pro PA Speaker",
    category: "Speakers",
    description: "Portable, clear-sounding PA speakers for speeches, background music, and smaller events.",
    image: "/bose-s1-pro.png",
    options: [
      { label: "Pair (2 speakers)", price: 95 },
      { label: "Single speaker", price: 55 },
    ],
    details: [
      "150W per speaker",
      "Bluetooth and AUX playback",
      "Power cables & Speaker stands included",
    ],
  },
  {
    slug: "yamaha-dxr15",
    name: "Yamaha DXR15 PA Speaker",
    category: "Speakers",
    popular: true,
    description: "High-output active PA speakers for parties, live music, and larger venues.",
    image: "/yamaha-dxr15-product.jpg",
    options: [
      { label: "Pair (2 speakers)", price: 135 },
      { label: "Single speaker", price: 75 },
    ],
    details: [
      "1100W peak per speaker",
      "15-inch active PA speaker",
      "Power cables & Speaker stands included",
    ],
  },
  {
    slug: "behringer-b1200d-pro",
    name: "Behringer Eurolive B1200D Pro Active Subwoofer",
    category: "Subwoofers",
    description: "Active 12-inch subwoofer for adding punch and low-end impact to parties, live music, and larger events.",
    image: "/behringer-b1200d-pro.jpg",
    options: [{ label: "Single subwoofer", price: 50 }],
    details: [
      "500W active subwoofer",
      "12-inch low-frequency driver",
      "Built-in amplifier; no separate power amp needed",
    ],
  },
  {
    slug: "presonus-air15s",
    name: "PreSonus AIR15s Active Subwoofer",
    category: "Subwoofers",
    popular: true,
    description: "Active 15-inch subwoofer for adding deep low-end to PA setups, parties, and live music.",
    image: "/presonus-air15s-front-cropped.webp",
    options: [{ label: "Single subwoofer", price: 65 }],
    details: [
      "15-inch active subwoofer",
      "1200W peak Class D power",
      "Variable low-pass filter for matching PA speakers",
    ],
  },
  {
    slug: "behringer-xm8500",
    name: "Behringer Ultravoice XM8500 Dynamic Microphone",
    category: "Microphones",
    description: "Reliable wired dynamic microphone for speeches, vocals, announcements, and live events.",
    image: "/behringer-xm8500.jpg",
    options: [{ label: "Single microphone", price: 10 }],
    details: [
      "Cardioid dynamic vocal microphone",
      "Built-in wind and pop filtering",
      "Wired XLR connection",
    ],
  },
  {
    slug: "shure-sm58",
    name: "Shure SM58",
    category: "Microphones",
    popular: true,
    description: "Industry-standard vocal microphone for speeches, singing, announcements, and live performance.",
    image: "/shure-sm58.jpg",
    options: [{ label: "Single microphone", price: 15 }],
    details: [
      "Cardioid dynamic microphone for vocals and speech",
      "Built-in pop filter and spherical grille",
      "Wired XLR connection to a mixer or PA speaker",
    ],
  },
  {
    slug: "shure-sm57",
    name: "Shure SM57",
    category: "Microphones",
    description: "Versatile dynamic microphone for instruments, amps, percussion, and stage use.",
    image: "/shure-sm57.webp",
    options: [{ label: "Single microphone", price: 15 }],
    details: [
      "Cardioid dynamic instrument microphone",
      "Suited to drums, guitar amps, and brass",
      "Wired XLR connection",
    ],
  },
  {
    slug: "shure-sm7b",
    name: "Shure SM7B",
    category: "Microphones",
    description: "Broadcast-style dynamic microphone for vocals, podcasting, voiceover, and studio applications.",
    image: "/shure-sm7b.jpg",
    options: [{ label: "Single microphone", price: 35 }],
    details: [
      "Dynamic microphone for vocals, podcasting, and voiceover",
      "Bass roll-off and presence boost controls",
      "XLR connection; microphone preamp or audio interface required",
    ],
  },
  {
    slug: "k60-wireless",
    name: "K60 Wireless Microphone",
    category: "Microphones",
    description: "Wireless handheld microphone system for speeches, presentations, karaoke, and events.",
    image: "/k60-wireless-microphone.webp",
    options: [{ label: "Single microphone", price: 25 }],
    details: [
      "Wireless handheld microphone",
      "Wireless receiver included",
      "Receiver connects to your mixer or PA speaker",
    ],
  },
  {
    slug: "beamz-s1500",
    name: "BeamZ S1500 Smoke Machine",
    category: "Effects",
    popular: true,
    description: "Add atmosphere to your event with clouds of smoke that drift through the space.",
    image: "/beamz-s1500-smoke-machine.webp",
    options: [{ label: "Single smoke machine", price: 30 }],
    details: [
      "Creates visible smoke clouds for a more dramatic event atmosphere",
      "Supplied pre-filled with smoke liquid",
    ],
  },
  {
    slug: "pioneer-ddj-flx4",
    name: "Pioneer DDJ-FLX4 DJ Controller",
    category: "DJ Controllers",
    description: "Compact 2-channel DJ controller for mixing music at parties and events with your own compatible laptop.",
    image: "/pioneer-ddj-flx4.png",
    options: [{ label: "Single controller", price: 40 }],
    details: [
      "2-channel DJ controller compatible with rekordbox and Serato DJ Lite",
      "USB cable, RCA audio cable & carry case included",
      "Bring your own compatible laptop and headphones",
      "Speakers hired separately",
    ],
  },
  ...Object.entries(addOnCatalog)
    .filter(([slug]) => slug !== "wireless-microphones")
    .map(([slug, addOn]) => ({
    slug: `hire-${slug}`,
    name: addOn.name.replace(" Upgrade", ""),
    category: addOn.category ?? "Accessories",
    popular: addOn.popular,
    description: addOn.description,
    image: addOn.image,
    imageSize: addOn.imageSize,
    options: [{ label: "Single item", price: addOn.price }],
    details: addOn.details,
    })),
];

const heroHeadingLines = ["Good sound.", "Less stress."];

export const business = {
  name: "Peppermint Audio",
  abn: "44 506 480 694",
  website: "https://www.peppermintaudio.com.au",
  serviceArea: "Melbourne",
  pickupSuburb: "Abbotsford",
  pickupPostcode: "3067",
  pickupAddress: "181 Nicholson St, Abbotsford VIC 3067",
  phone: "0452 316 823",
  email: "contactus@peppermintaudio.com.au",
  googleReviewsUrl: "https://share.google/cZGs5Tv7JAHs5oQOi",
  heroHeading: heroHeadingLines.join(" "),
  heroHeadingLines,
  heroSubheading:
    "Parties · Weddings · Corporate events · Live gigs",
  heroSupportingText: "Speaker & PA hire in Melbourne. Packages or individual gear.",
  heroImage: "/home-live-sound.jpg",
  ctaImage:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&h=700&fit=crop",
};

export const privacyPolicy = {
  title: "Privacy Policy",
  introduction: "Peppermint Audio collects personal information to respond to enquiries and manage audio-equipment hires.",
  sections: [
    {
      title: "Information we collect and use",
      body: "We collect your name, contact details, event details, hire selections, photo ID, payment records and related communications. We use this information to verify your identity, arrange your hire, process payments and deposits, send confirmations and reminders, and resolve hire-related issues.\n\nPhoto-ID images are stored privately and sent to our business inbox with your booking request. Card details are handled by our payment provider; our booking records do not store full card numbers or security codes.",
    },
    {
      title: "Sharing and Google Calendar",
      body: "We share relevant information with providers that support hosting, storage, payments, email, SMS and advertising measurement. These providers may process information outside Australia.\n\nWith the business account holder's authorisation, we use Google Calendar to create and update confirmed-hire events containing customer contact details, hire details and relevant booking notes. Photo ID is not included. Customers do not need to grant us access to their calendars.",
    },
    {
      title: "Website storage and advertising",
      body: "Our website remembers your cart and unfinished booking details using browser storage. Google Ads may use cookies and similar technologies to measure advertising performance. You can manage cookies and clear saved website data in your browser settings.",
    },
    {
      title: "Security and retention",
      body: "We use access controls and private storage to help protect your information. We retain information as reasonably needed to manage hires, resolve outstanding matters and meet legal obligations.",
    },
    {
      title: "Your information and concerns",
      body: `To request access, correction or deletion of your information, or raise a privacy concern, email ${business.email} or call ${business.phone}. We may verify your identity and may need to retain some records for legal or outstanding business matters.\n\nWe may update this policy as our practices change.`,
    },
  ],
};

export const hireTerms = [
  {
    title: "1. Booking requests and confirmation",
    body: "Submitting a booking request does not confirm equipment availability or reserve a confirmed hire. We review availability, final pricing and the payment arrangements before confirming your booking.\n\nYour booking confirmation sets out the agreed equipment, hire dates and other relevant arrangements. Contact us promptly if any details are incorrect.",
  },
  {
    title: "2. Identification",
    body: "Supply the requested photo-ID images with your booking request and present valid photo ID at pickup. The booking name must match the ID.\n\nWe reserve the right to refuse hire if your identity cannot be verified. Our Privacy Policy explains how we handle personal information and photo ID.",
  },
  {
    title: "3. Hire charges and payment",
    body: "We will confirm the hire charges and payment arrangements before confirming your booking. Follow the payment instructions supplied with your invoice or payment request.\n\nAny cash-on-pickup arrangement must be agreed with us in advance. A payment receipt records a payment; the booking confirmation records the confirmed hire arrangements.",
  },
  {
    title: "4. Security deposit",
    body: "A refundable security deposit is required for all hires. We will confirm the amount before booking.\n\nFor hires of three nights or less, a card may be saved securely with your consent and a temporary security-deposit hold placed before pickup. The payment request sets out the amount and the authorisation required. We will contact you if the deposit needs attention before pickup.\n\nLonger hires use bank transfer. Where a bank-transfer deposit is agreed, follow the instructions supplied with your payment request.\n\nThe deposit covers damage, missing items and late returns. Card holds are released, or transferred deposits refunded, when equipment is returned on time, in its original condition and with all accessories, subject to any applicable deductions.\n\nYou remain responsible for applicable repair, replacement or late-return charges where they exceed the deposit.",
  },
  {
    title: "5. Pickup, transport and return",
    body: `Equipment is collected and returned from:\n\n${business.pickupAddress}\n\nCollect and return equipment at the agreed times. You are responsible for arranging suitable transport and protecting the equipment during loading, travel and unloading.\n\nReturn all equipment and supplied accessories.`,
  },
  {
    title: "6. Responsibility for equipment",
    body: "You are responsible for the equipment from pickup until return.\n\nDo not drop equipment, expose it to water or misuse it. Equipment must be used safely and for normal event purposes, such as parties, functions, presentations and live performances. Do not use it for illegal activities or in unsafe environments.\n\nDamage or loss may be charged at the applicable repair or replacement cost.",
  },
  {
    title: "7. Equipment selection and setup",
    body: "Check that your selected equipment and package inclusions meet your event requirements. You are responsible for asking about additional equipment or accessories that are not included in your selection.\n\nAllow sufficient time to set up and test the equipment before your event. Follow the setup and operating guidance supplied with the hire.",
  },
  {
    title: "8. Late returns",
    body: "Equipment must be returned at the agreed time. Late returns may incur additional fees, including charges for delays affecting other bookings.\n\nIf you expect to be late, contact us as soon as possible. An extension is not agreed unless we confirm it.",
  },
  {
    title: "9. Faults and problems",
    body: "Contact Peppermint Audio immediately if equipment is not working correctly or another issue occurs.\n\nVenue power problems, setup errors and other external limitations may affect equipment performance. Subject to your rights under Australian Consumer Law, we are not responsible for problems caused by those external factors.",
  },
  {
    title: "10. Booking changes and cancellations",
    body: "Contact us as soon as possible if you need to change or cancel your booking. We will advise whether a change can be accommodated and explain any applicable payment or refund arrangements.",
  },
  {
    title: "11. Liability and consumer rights",
    body: "You are responsible for using and transporting the equipment safely.\n\nNothing in these terms excludes, restricts or modifies any rights or remedies that cannot lawfully be excluded, including applicable rights under Australian Consumer Law.\n\nSubject to those rights, Peppermint Audio is not responsible for injury, damage or lost event time caused by your misuse of equipment, unsafe setup or external factors outside our control.",
  },
  {
    title: "12. Agreement and authorisations",
    body: "By accepting these terms with your booking request, you acknowledge the hire conditions above. Any card-saving or payment authorisation is provided separately through the relevant payment request.\n\nCompleting the booking and providing the agreed deposit authorisation or bank transfer confirms your agreement to the hire terms, including responsibility for applicable damage, loss and late-return charges.",
  },
];

export const homeHireSteps = [
  {
    title: "Find your sound.",
    detail: "Pick a package or just the gear you need. Add it to your cart, choose your dates, and send us a booking request.",
  },
  {
    title: "We'll sort the details.",
    detail: "We'll check availability and get back to you about pricing, payment, and pickup. Your request isn't a confirmed hire just yet.",
  },
  {
    title: "Plug in. Enjoy.",
    detail: "Once your hire is confirmed, collect from Abbotsford. We'll walk you through the setup, then you're off. Return the gear at the agreed time.",
  },
];

export const packageTiers: PackageTier[] = [
  {
    slug: "speech-presentation-wireless",
    name: "Speech & Presentation Package",
    price: 65,
    capacity: "up to 40 people",
    summary: "A portable Bose PA speaker and wireless microphone for clear, simple speeches and presentations.",
    bestFor: "Speeches, presentations, small meetings, and announcements",
    image: "/speech-presentation-package.png",
    addOnSlugs: [],
    inclusions: [
      "1 x Portable Bose PA Speaker.",
      "1 x Wireless Microphone with receiver.",
      "Power cable for the Bose speaker.",
      "Bluetooth or AUX phone connection.",
    ],
  },
  {
    slug: "speech-presentation",
    name: "Small Budget Event Package",
    price: 120,
    capacity: "up to 60 people",
    summary: "Two 150W speakers, stands, a wired microphone, and a simple mixer for clear speeches and presentations.",
    bestFor: "Small parties, presentations, community events, and announcements",
    image: "/small-budget-event-package-v2.png",
    addOnSlugs: [
      "wireless-microphones",
      "party-lights-bar",
      "di-box",
      "four-channel-di-box",
      "spirit-e12-mixer",
      "behringer-x32",
      "party-light-par-can",
    ],
    inclusions: [
      "2 x Bose S1 Pro PA Speakers (150W each).",
      "2 x Speaker Stands.",
      "1 x Wired Microphone.",
      "Easy to use 2-channel Behringer Xenyx mixer.",
      "Power Cables for All Equipment.",
      "AUX or Bluetooth Phone Connection.",
      "Long Extension Leads as Needed.",
      "Multiple XLR Audio Cables as Needed.",
    ],
  },
  {
    slug: "standard-party-events",
    name: "Standard Party & Events Package",
    price: 160,
    capacity: "up to 120 people",
    summary: "Two 1100W peak speakers, stands, a wired microphone, and mixer for parties and private events.",
    bestFor: "Parties, private functions, small corporate events, and live gigs",
    image: "/standard-party-events-package-v2.png",
    addOnSlugs: [
      "wireless-microphones",
      "party-lights-bar",
      "di-box",
      "four-channel-di-box",
      "spirit-e12-mixer",
      "behringer-x32",
      "party-light-par-can",
    ],
    inclusions: [
      "2 x Yamaha DXR15 Speakers (1100W peak each).",
      "2 x Speaker Stands.",
      "1 x Wired Microphone.",
      "Easy to use 2-channel Behringer Xenyx mixer.",
      "Power Cables for All Equipment.",
      "AUX or Bluetooth Phone Connection.",
      "Long Extension Leads as Needed.",
      "Multiple XLR Audio Cables as Needed.",
    ],
    notes: "Most popular",
  },
  {
    slug: "budget-with-a-boom",
    name: "Budget With A Boom",
    price: 170,
    capacity: "up to 60 people",
    summary: "The Small Budget Event setup with a Behringer subwoofer for extra low-end impact.",
    bestFor: "Small parties that want more bass without moving up to a full-scale event system",
    image: "/budget-with-a-boom-package-v3.png",
    addOnSlugs: [
      "wireless-microphones",
      "party-lights-bar",
      "di-box",
      "four-channel-di-box",
      "spirit-e12-mixer",
      "behringer-x32",
      "party-light-par-can",
    ],
    inclusions: [
      "2 x Bose S1 Pro PA Speakers (150W each).",
      "2 x Speaker Stands.",
      "1 x Wired Microphone.",
      "1 x Behringer Eurolive B1200D Pro Active Subwoofer.",
      "Easy to use 2-channel Behringer Xenyx mixer.",
      "Power Cables for All Equipment.",
      "AUX or Bluetooth Phone Connection.",
      "Long Extension Leads as Needed.",
      "Multiple XLR Audio Cables as Needed.",
    ],
  },
  {
    slug: "big-celebration",
    name: "Big Celebration Package",
    price: 240,
    capacity: "up to 300 people",
    summary: "Two 1100W peak speakers, stands, two wireless microphones, a PreSonus AIR15s subwoofer, and mixer for bigger celebrations.",
    bestFor: "Weddings, large parties, celebrations, and live gigs",
    image: "/big-celebration-package-v3.png",
    addOnSlugs: [
      "di-box",
      "four-channel-di-box",
      "behringer-x32",
      "party-lights-bar",
      "party-light-par-can",
    ],
    inclusions: [
      "2 x Yamaha DXR15 Speakers (1100W peak each).",
      "2 x Speaker Stands.",
      "2 x Wireless Microphones.",
      "1 x 15 inch PreSonus AIR15s Active Subwoofer.",
      "Easy to use 2-channel Behringer Xenyx mixer.",
      "Power Cables for All Equipment.",
      "AUX or Bluetooth Phone Connection.",
      "Long Extension Leads as Needed.",
      "Multiple XLR Audio Cables as Needed.",
    ],
    notes: "Highly recommended for weddings",
  },
];

export const howItWorks = [
  {
    title: "Before your event",
    detail:
      "Choose your package or individual equipment, select your dates and send a request. We'll check availability and finalise the details before confirming your hire.",
  },
  {
    title: "Pickup & setup",
    detail:
      "Pick up from Abbotsford 3067 with your photo ID. We'll show you the setup. Set up early; we're a phone call away if you need a hand.",
  },
  {
    title: "After your event",
    detail:
      "Return the gear, cables and accessories at the agreed time. We'll check everything back in with you.",
  },
];

export const faqs: {
  question: string;
  answer: string;
  links?: { label: string; href: string }[];
}[] = [
  {
    question: "I just want to play Spotify and say a few words. Which package do I need?",
    answer:
      `Honestly, you can do both with every package! Connect your phone through AUX or Bluetooth, put on your playlist, and use the mic when you need it.\n\nIf speeches are the main thing, with some light music in the background, go for our ${packageTiers[0].name}. Want a fuller sound for a nice backyard party? The ${packageTiers[2].name} is a great fit.\n\nGot a bigger crowd and want wireless microphones, more bass, and room for y'all to have a boogie? Go for the ${packageTiers[4].name}.\n\nFor a smaller gathering, there's also the ${packageTiers[1].name}, or ${packageTiers[3].name} if you'd like extra bass without the bigger setup.`,
    links: [{ label: "Have a look at the packages", href: "/packages" }],
  },
  {
    question: "How early should I book?",
    answer:
      "We take bookings anywhere from six months ahead to last-minute requests, subject to availability.\n\nWeekend slots often get booked out quickly, so the sooner you get in, the better! If your event is coming up soon, still reach out and we'll see what we can do.",
  },
  {
    question: "I have absolutely NO technical experience. Can I set this up myself?",
    answer:
      "Yes, absolutely! You don't need to be a sound engineer to use these speakers.\n\nWe'll give you a simple walkthrough when you collect the gear, and you can always call us later if you need a hand. We barely get any setup calls because most people get it right themselves!\n\nGive yourself a few hours before the event to set up and try everything out. That way you're not worrying about it at the last minute, and you can have a sound experience (no pun intended).",
    links: [{ label: "Take a look at the setup guide", href: "/get-started" }],
  },
  {
    question: "I've got a very specific requirement though. Can you help?",
    answer:
      "Maybe Joe mama's neighbour's third kid has been learning the clarinet and wants to play one song at your event. Or you've got a super niche underground alien-tech instrument you want to plug into the speakers. Let us know what you're bringing and we'll help work out what you need!\n\nFor something small like a cable or an adapter, it's usually on the house, subject to what we have available. Check the add-ons for your package too, in case your requirement is already covered there.\n\nYou can also hire individual equipment, or combine it with a package in the same cart.",
    links: [
      { label: "Browse packages & add-ons", href: "/packages" },
      { label: "Ask us about your setup", href: "/contact" },
      { label: "Browse individual equipment", href: "/equipment" },
    ],
  },
  {
    question: "I just need a couple of speakers, not a whole package. Can I do that?",
    answer:
      "Absolutely! Whether you're a DJ who already has the rest sorted, or you just need two speakers for your event, you don't have to hire a whole package.\n\nBefore you message us saying \"How much for just two speakers?\", have a quick browse of our individual equipment! The prices are all there, so you can pick what you need and add it straight to your cart.\n\nAnd if you're not sure which speakers to go for, or what you'll need to connect them, reach out. We've got you.",
    links: [{ label: "Have a browse of the individual gear", href: "/equipment" }],
  },
  {
    question: "What if I need the gear for more than one night?",
    answer: `${hirePricing.summary}\n\n${hirePricing.details} Security deposits and separately quoted services are not included in this discount.`,
    links: [{ label: "See your hire total in the cart", href: "/cart" }],
  },
  {
    question: "Where do I pick up and return the gear? What about delivery?",
    answer:
      `Pickup and return are in ${business.pickupSuburb} ${business.pickupPostcode}. We'll agree on the times with you when your booking is confirmed.\n\nOur standard service is pickup. If you need delivery or hands-on setup, mention it in your enquiry and we'll let you know what's possible for your event.`,
  },
  {
    question: "I'm ready. How do I book?",
    answer:
      "Add your package and any extra equipment to the cart, choose your hire dates, and continue to the booking request.\n\nSend us your event details and we'll get back to you about availability, final pricing, payment, and pickup arrangements. Sending the request doesn't confirm the hire just yet.",
    links: [{ label: "Browse packages", href: "/packages" }],
  },
];
