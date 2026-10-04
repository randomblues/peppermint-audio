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

export type AddOn = {
  name: string;
  price: number;
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
    image: "/cr-lite-magikbar.avif",
  },
  "wireless-microphones": {
    name: "Wireless Microphone Upgrade",
    price: 20,
  },
  "di-box": {
    name: "Pro DI Box",
    price: 15,
    image: "/pro-di-box.webp",
  },
  "generic-di-box": {
    name: "Generic DI Box",
    price: 10,
    image: "/generic-di-box.jpg",
  },
  "four-channel-di-box": {
    name: "4-Channel DI Box",
    price: 20,
    image: "/dbx-di4.jpg",
    imageSize: "compact",
  },
  "spirit-e12-mixer": {
    name: "Spirit E12 / 12-Channel Soundcraft Mixer Upgrade",
    price: 30,
    image: "/soundcraft-spirit-e12.jpg",
  },
  "behringer-x32": {
    name: "Behringer X32 Digital Mixer Upgrade",
    price: 110,
    image: "/behringer-x32.jpg",
  },
  "party-light-par-can": {
    name: "Party Light PAR Can",
    price: 10,
    image: "/par-can-generic.jpg",
  },
  "extension-reel-10m": {
    name: "10m Extension Reel",
    price: 10,
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
      "Availability confirmed before hire",
    ],
  },
  {
    slug: "behringer-xm8500",
    name: "Behringer Ultravoice XM8500 Dynamic Microphone",
    category: "Microphones",
    description: "Reliable wired dynamic microphone for speeches, vocals, announcements, and live events.",
    image: "/behringer-xm8500.jpg",
    options: [{ label: "Single microphone", price: 10 }],
    details: ["Single microphone hire", "Availability confirmed before hire"],
  },
  {
    slug: "shure-sm58",
    name: "Shure SM58",
    category: "Microphones",
    description: "Industry-standard vocal microphone for speeches, singing, announcements, and live performance.",
    image: "/shure-sm58.jpg",
    options: [{ label: "Single microphone", price: 15 }],
    details: ["Single microphone hire", "Availability confirmed before hire"],
  },
  {
    slug: "shure-sm57",
    name: "Shure SM57",
    category: "Microphones",
    description: "Versatile dynamic microphone for instruments, amps, percussion, and stage use.",
    image: "/shure-sm57.webp",
    options: [{ label: "Single microphone", price: 15 }],
    details: ["Single microphone hire", "Availability confirmed before hire"],
  },
  {
    slug: "shure-sm7b",
    name: "Shure SM7B",
    category: "Microphones",
    description: "Broadcast-style dynamic microphone for vocals, podcasting, voiceover, and studio applications.",
    image: "/shure-sm7b.jpg",
    options: [{ label: "Single microphone", price: 35 }],
    details: ["Single microphone hire", "Availability confirmed before hire"],
  },
  {
    slug: "k60-wireless",
    name: "K60 Wireless Microphone",
    category: "Microphones",
    description: "Wireless handheld microphone system for speeches, presentations, karaoke, and events.",
    image: "/k60-wireless-microphone.webp",
    options: [{ label: "Single microphone", price: 25 }],
    details: ["Wireless receiver included", "Availability confirmed before hire"],
  },
  ...Object.entries(addOnCatalog)
    .filter(([slug]) => slug !== "wireless-microphones")
    .map(([slug, addOn]) => ({
    slug: `hire-${slug}`,
    name: addOn.name.replace(" Upgrade", ""),
    category: "Mixers, microphones & lighting",
    description: `Add this item on its own when you only need ${addOn.name.toLowerCase().replace(" upgrade", "")}.`,
    image: addOn.image,
    imageSize: addOn.imageSize,
    options: [{ label: "Single item", price: addOn.price }],
    details: ["Collected from Abbotsford 3067", "Availability confirmed before hire"],
    })),
];

export const hireTerms = [
  {
    title: "1. ID Verification",
    body: "Valid photo ID must be presented at pickup. The booking name must match the ID. We reserve the right to refuse hire if ID cannot be verified.",
  },
  {
    title: "2. Security Deposit",
    body: "A refundable deposit is required for all hires. The amount depends on the package and will be confirmed before booking. The deposit covers damage, missing items, late returns, or excessive cleaning. Deposits are fully refunded if equipment is returned on time, in original condition, and with all accessories.",
  },
  {
    title: "3. Equipment Responsibility",
    body: "The hirer is fully responsible for all equipment from pickup until return. Equipment must not be dropped, exposed to water, or misused. Any damage or loss will be charged at repair or replacement cost.",
  },
  {
    title: "4. Late Returns",
    body: "Equipment must be returned at the agreed time. Late returns may incur additional fees. Delays affecting other bookings may result in extra charges.",
  },
  {
    title: "5. Use of Equipment",
    body: "Equipment is for normal event use only, such as parties and functions. It must not be used for illegal activities or unsafe environments. The hirer is responsible for explicitly enquiring about any additional equipment or accessories required that are not included in the selected package.",
  },
  {
    title: "6. Pickup & Return",
    body: "All equipment is collected and returned from 181 Nicholson St, Abbotsford, Melbourne (3067). The hirer must ensure suitable transport to prevent damage.",
  },
  {
    title: "7. Faults & Issues",
    body: "If issues occur, contact Peppermint Audio immediately. We are not responsible for venue power issues, setup errors, or external limitations.",
  },
  {
    title: "8. Liability",
    body: "We are not liable for injury, damage, or loss of event time caused by equipment use or external factors. The hirer assumes full responsibility once equipment is collected.",
  },
  {
    title: "9. Agreement",
    body: "By completing the booking and paying the deposit, you confirm you have read and agree to these terms and authorise charges for damage, loss, or late return.",
  },
];

export const business = {
  name: "Peppermint Audio",
  website: "https://www.peppermintaudio.com.au",
  serviceArea: "Melbourne",
  pickupSuburb: "Abbotsford",
  pickupPostcode: "3067",
  phone: "0452 316 823",
  email: "contactus@peppermintaudio.com.au",
  googleReviewsUrl: "https://share.google/cZGs5Tv7JAHs5oQOi",
  heroHeading: "Audio Rental for Melbourne Events",
  heroSubheading:
    "Reliable audio system packages with speakers, microphones, mixers, and cables for parties, weddings, small corporate events, live gigs, and private functions.",
  heroImage: "/hero-mixer.jpg",
  ctaImage:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&h=700&fit=crop",
};

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
    summary: "Two 1100W peak speakers, stands, two wireless microphones, a subwoofer, and mixer for bigger celebrations.",
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
      "1 x 15-Inch Subwoofer.",
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
    title: "Choose your setup",
    detail:
      "Browse complete packages or individual equipment. Add a package, specific items, or both to your cart.",
  },
  {
    title: "Submit a booking request",
    detail:
      "Open your cart, enter your event details, upload both required photo IDs, and accept the hire terms. Sending the request does not confirm the booking.",
  },
  {
    title: "We review availability",
    detail:
      "We check your date and selected equipment, then contact you to confirm availability, pricing, and the pickup and return window.",
  },
  {
    title: "Collect from Abbotsford",
    detail:
      "After your request is confirmed, collect from Abbotsford 3067. Bring photo ID and we will run through the setup with you.",
  },
  {
    title: "Run your event",
    detail:
      "Use the system for the hire period. Support is available if you get stuck.",
  },
  {
    title: "Return gear",
    detail:
      "Pack down and return at the agreed time. We check everything back in quickly.",
  },
];

export const faqs = [
  {
    question: "Why hire Peppermint Audio?",
    answer:
      "Most rental companies hand you a pair of speakers and leave you to work out the rest. We make it simple with complete, ready-to-go systems for your event. But hey, if two speakers is all you need, we've got your back too ;)",
  },
  {
    question: "What packages are available?",
    answer:
      "Our complete, ready-to-use packages include the Speech & Presentation Package with a portable Bose PA speaker and wireless microphone for up to 40 people at $65, the Small Budget Event Package for up to 60 people at $120, Budget With A Boom with a Behringer subwoofer for up to 60 people at $170, the Standard Party & Events Package for up to 120 people at $160, and the Big Celebration Package for up to 300 people at $240.",
  },
  {
    question: "Which package is right for my event?",
    answer:
      "Choose based on your guest count and event type. Speech & Presentation is best for smaller speeches and presentations when you need a wireless microphone. Small Budget Event is suited to small parties and presentations with a mixer and wired microphone. Budget With A Boom is for smaller parties that want extra bass. Standard Party & Events is the all-rounder for parties and private functions. Big Celebration is for weddings and larger events. Individual equipment is available when you only need specific items.",
  },
  {
    question: "Can I hire individual equipment?",
    answer:
      "Yes. Browse the individual equipment catalogue to hire specific speakers, microphones, mixers, DI boxes, lighting, and accessories without choosing a package.",
  },
  {
    question: "Can I combine a package with individual equipment?",
    answer:
      "Yes. Add a package and any extra equipment you need to your cart, then submit one booking request for the complete selection.",
  },
  {
    question: "What is included in every package?",
    answer:
      "Every package is a complete setup rather than just a pair of speakers. Depending on the package, you get speakers, stands, microphones, a mixer, subwoofers, power cables, AUX or Bluetooth phone connection, extension leads, and XLR audio cables.",
  },
  {
    question: "Do I need sound or event experience?",
    answer:
      "No. The packages are designed to be simple and plug-and-play.",
  },
  {
    question: "Can I connect my phone or music device?",
    answer:
      "Yes. Each package includes an AUX or Bluetooth connection for playing audio from a phone or other compatible device.",
  },
  {
    question: "Where do I collect the equipment?",
    answer:
      "Equipment is collected from Abbotsford 3067. We confirm the exact pickup and return window when your booking is confirmed.",
  },
  {
    question: "Do you deliver or set everything up for me?",
    answer:
      "The standard service is pickup from Abbotsford. If you need delivery or hands-on setup, mention it in your enquiry and we can confirm what is possible for your event.",
  },
  {
    question: "How do I book a package?",
    answer:
      "Choose a package, add any individual equipment you need, and continue to booking from your cart. Submit your event date, guest count, and details, and we will review availability before confirming the request and pickup arrangements with you.",
  },
];
