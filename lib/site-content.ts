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

export type AddOn = {
  name: string;
  price: number;
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
    category: "Lighting",
    image: "/cr-lite-magikbar.avif",
  },
  "wireless-microphones": {
    name: "Wireless Microphone Upgrade",
    price: 20,
    category: "Microphones",
  },
  "di-box": {
    name: "Pro DI Box",
    price: 15,
    category: "DI boxes",
    image: "/pro-di-box.webp",
  },
  "generic-di-box": {
    name: "Generic DI Box",
    price: 10,
    category: "DI boxes",
    image: "/generic-di-box.jpg",
  },
  "four-channel-di-box": {
    name: "4-Channel DI Box",
    price: 20,
    category: "DI boxes",
    image: "/dbx-di4.jpg",
    imageSize: "compact",
  },
  "spirit-e12-mixer": {
    name: "Spirit E12 / 12-Channel Soundcraft Mixer Upgrade",
    price: 30,
    category: "Mixers",
    image: "/soundcraft-spirit-e12.jpg",
  },
  "behringer-x32": {
    name: "Behringer X32 Digital Mixer Upgrade",
    price: 110,
    category: "Mixers",
    image: "/behringer-x32.jpg",
  },
  "party-light-par-can": {
    name: "Party Light PAR Can",
    price: 10,
    category: "Lighting",
    image: "/par-can-generic.jpg",
  },
  "extension-reel-10m": {
    name: "10m Extension Reel",
    price: 10,
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
    category: addOn.category ?? "Accessories",
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
    body: "A refundable deposit is required for all hires. The amount depends on the package and will be confirmed before booking. For hires of three nights or less, the hire payment is taken when you pay and, with your consent, your card is saved securely for a temporary deposit hold one day before pickup. For last-minute bookings, the hold is attempted after payment. We will contact you if the deposit needs attention before pickup. Longer hires use bank transfer. The deposit covers damage, missing items, or late returns. Card holds are released, or transferred deposits refunded, if equipment is returned on time, in original condition, and with all accessories.",
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
    body: "By completing the booking and providing the requested deposit authorisation or bank transfer, you confirm you have read and agree to these terms and authorise charges for damage, loss, or late return.",
  },
];

const heroHeadingLines = ["Good sound.", "Less stress."];

export const business = {
  name: "Peppermint Audio",
  abn: "44 506 480 694",
  website: "https://www.peppermintaudio.com.au",
  serviceArea: "Melbourne",
  pickupSuburb: "Abbotsford",
  pickupPostcode: "3067",
  phone: "0452 316 823",
  email: "contactus@peppermintaudio.com.au",
  googleReviewsUrl: "https://share.google/cZGs5Tv7JAHs5oQOi",
  heroHeading: heroHeadingLines.join(" "),
  heroHeadingLines,
  heroSubheading:
    "Speakers and microphones for parties, weddings and live events. Choose a complete package or just the gear you need. We'll help you get set up.",
  heroImage: "/home-live-sound.jpg",
  ctaImage:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&h=700&fit=crop",
};

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
    title: "Send an enquiry",
    detail:
      "Open your cart and send one enquiry for your complete selection. This lets us check availability and discuss the hire details with you.",
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
