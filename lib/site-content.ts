export type PackageTier = {
  slug: string;
  name: string;
  price: number;
  capacity: string;
  summary: string;
  bestFor: string;
  inclusions: string[];
  notes?: string;
  image: string;
};

export const business = {
  name: "Peppermint Audio",
  serviceArea: "Melbourne",
  pickupSuburb: "Abbotsford",
  pickupPostcode: "3067",
  phone: "0400 000 000",
  email: "hello@peppermintaudio.com.au",
  heroHeading: "Audio Rental for Melbourne Events",
  heroSubheading:
    "Reliable audio system packages with speakers, microphones, mixers, and cables for parties, weddings, small corporate events, live gigs, and private functions.",
  heroImage:
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=600&fit=crop",
};

export const packageTiers: PackageTier[] = [
  {
    slug: "speech-presentation",
    name: "Speech & Presentation Package",
    price: 120,
    capacity: "20-60 people",
    summary: "A straightforward, plug-and-play setup for clear speeches and presentations.",
    bestFor: "Speeches, presentations, small corporate events, and announcements",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop",
    inclusions: [
      "2 x Bose S1 Pro PA speakers",
      "2 x speaker stands",
      "1 x microphone",
      "Easy-to-use sound mixer",
      "Power cables for all equipment",
      "AUX or Bluetooth phone connection",
      "Long extension leads as needed",
      "Multiple XLR audio cables as needed",
    ],
  },
  {
    slug: "standard-party-events",
    name: "Standard Party & Events Package",
    price: 160,
    capacity: "60-120 people",
    summary: "The easy all-rounder for parties, birthdays, corporate events, and small live gigs.",
    bestFor: "Parties, private functions, small corporate events, and live gigs",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop",
    inclusions: [
      "2 x Yamaha DXR15 speakers",
      "2 x speaker stands",
      "1 x microphone",
      "Easy-to-use sound mixer",
      "Power cables for all equipment",
      "AUX or Bluetooth phone connection",
      "Long extension leads as needed",
      "Multiple XLR audio cables as needed",
    ],
    notes: "Most popular",
  },
  {
    slug: "big-celebration",
    name: "Big Celebration Package",
    price: 240,
    capacity: "100-250 people",
    summary: "More headroom and bass for weddings, larger celebrations, and bigger live events.",
    bestFor: "Weddings, large parties, celebrations, and live gigs",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=400&fit=crop",
    inclusions: [
      "2 x Yamaha DXR15 speakers",
      "2 x speaker stands",
      "2 x microphones",
      "1 x 15-inch subwoofer",
      "Easy-to-use sound mixer",
      "Power cables for all equipment",
      "AUX or Bluetooth phone connection",
      "Long extension leads as needed",
      "Multiple XLR audio cables as needed",
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
    question: "Why hire Peppermint Audio instead of a basic speaker rental?",
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
      "Choose based on your expected guest count and event type. Speech & Presentation suits speeches, presentations, and small corporate events. Standard Party & Events is the all-round option for parties, functions, and small live gigs. Big Celebration adds extra microphones and a subwoofer for weddings, larger celebrations, and bigger live events.",
  },
  {
    question: "What is included in every package?",
    answer:
      "Every package is a complete setup rather than just a pair of speakers. Depending on the package, you get speakers, stands, microphones, a mixer, power cables, AUX or Bluetooth phone connection, extension leads, and XLR audio cables.",
  },
  {
    question: "Do I need sound or event experience?",
    answer:
      "No. The packages are designed to be simple and plug-and-play. We provide a straightforward setup walkthrough at pickup and an easy-to-follow guide so you can run the system confidently.",
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
      "The standard service is pickup from Abbotsford with a setup walkthrough. If you need delivery or hands-on setup, mention it in your enquiry and we can confirm what is possible for your event.",
  },
  {
    question: "How do I book a package?",
    answer:
      "Choose a package, submit an enquiry with your event date, guest count, and details, and we will confirm availability and the pickup arrangements with you.",
  },
];
