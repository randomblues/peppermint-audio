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
};

export const addOnCatalog: Record<string, AddOn> = {
  "party-lights-bar": {
    name: "All-in-One Party Lights Bar",
    price: 30,
  },
  "wireless-microphones": {
    name: "Wireless Microphone Upgrade",
    price: 20,
  },
  "di-box": {
    name: "DI Box",
    price: 10,
  },
  "four-channel-di-box": {
    name: "4-Channel DI Box",
    price: 20,
  },
  "spirit-e12-mixer": {
    name: "Spirit E12 / 12-Channel Soundcraft Mixer Upgrade",
    price: 30,
  },
  "behringer-x32": {
    name: "Behringer X32 Digital Mixer Upgrade",
    price: 110,
  },
  "party-light-par-can": {
    name: "Party Light PAR Can",
    price: 10,
  },
};

export const business = {
  name: "Peppermint Audio",
  serviceArea: "Melbourne",
  pickupSuburb: "Abbotsford",
  pickupPostcode: "3067",
  phone: "0452 316 823",
  email: "peppermintaudioau@gmail.com",
  heroHeading: "Audio Rental for Melbourne Events",
  heroSubheading:
    "Reliable audio system packages with speakers, microphones, mixers, and cables for parties, weddings, small corporate events, live gigs, and private functions.",
  heroImage: "/hero-mixer.jpg",
  ctaImage:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&h=700&fit=crop",
};

export const packageTiers: PackageTier[] = [
  {
    slug: "speech-presentation",
    name: "Speech & Presentation Package",
    price: 120,
    capacity: "20-60 people",
    summary: "Two 150W speakers, stands, a wired microphone, and a simple mixer for clear speeches and presentations.",
    bestFor: "Speeches, presentations, small corporate events, and announcements",
    image:
      "https://images.pexels.com/photos/164829/pexels-photo-164829.jpeg?w=600&h=400&fit=crop",
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
    capacity: "60-120 people",
    summary: "Two 1100W peak speakers, stands, a wired microphone, and mixer for parties and private events.",
    bestFor: "Parties, private functions, small corporate events, and live gigs",
    image:
      "https://images.pexels.com/photos/7715611/pexels-photo-7715611.jpeg",
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
    slug: "big-celebration",
    name: "Big Celebration Package",
    price: 240,
    capacity: "100-250 people",
    summary: "Two 1100W peak speakers, stands, two wireless microphones, a subwoofer, and mixer for bigger celebrations.",
    bestFor: "Weddings, large parties, celebrations, and live gigs",
    image:
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&h=400&fit=crop",
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
    title: "Choose your package",
    detail:
      "Tell us your date, venue type, and expected guests. We recommend the right setup.",
  },
  {
    title: "Confirm booking",
    detail:
      "We lock in your hire with package price, pickup window, and return time.",
  },
  {
    title: "Pick up in Abbotsford",
    detail:
      "Collect from Abbotsford 3067. We run through setup so you are ready to go.",
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
      "There are three complete, ready-to-use packages: Speech & Presentation for 20-60 people at $120, Standard Party & Events for 60-120 people at $160, and Big Celebration for 100-250 people at $240.",
  },
  {
    question: "Which package is right for my event?",
    answer:
      "Choose based on your guest count and event type. Speech & Presentation is best for smaller speeches and presentations. Standard Party & Events is the all-rounder for parties and private functions. Big Celebration is for weddings and larger events. Add-ons are available if you need anything extra.",
  },
  {
    question: "What is included in every package?",
    answer:
      "Every package is a complete setup rather than just a pair of speakers. Depending on the package, you get speakers, stands, microphones, a mixer, power cables, AUX or Bluetooth phone connection, extension leads, and XLR audio cables.",
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
      "Choose a package, submit an enquiry with your event date, guest count, and details, and we will confirm availability and the pickup arrangements with you.",
  },
];
