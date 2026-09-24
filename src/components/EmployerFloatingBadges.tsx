import FloatingBadges, { type Badge } from "./FloatingBadges";

const BADGES: Badge[] = [
  {
    id: "blue-collar",
    label: "Manufacturing",
    src: "/employer-types/blue-collar.jpg",
    top: "6%",
    left: "3%",
    duration: "5.4s",
    delay: "0s",
  },
  {
    id: "white-collar",
    label: "Corporate services",
    src: "/employer-types/white-collar.jpg",
    top: "16%",
    right: "4%",
    duration: "6.1s",
    delay: "0.6s",
  },
  {
    id: "construction",
    label: "Construction",
    src: "/employer-types/construction.jpg",
    top: "52%",
    left: "1%",
    duration: "5.8s",
    delay: "1.1s",
  },
  {
    id: "office",
    label: "Technology",
    src: "/employer-types/office.jpg",
    top: "58%",
    right: "2%",
    duration: "6.4s",
    delay: "0.3s",
  },
  {
    id: "retail",
    label: "Retail & F&B",
    src: "/employer-types/retail.jpg",
    bottom: "4%",
    left: "16%",
    duration: "5.6s",
    delay: "1.4s",
  },
  {
    id: "delivery",
    label: "Logistics",
    src: "/employer-types/delivery.jpg",
    bottom: "8%",
    right: "15%",
    duration: "6.7s",
    delay: "0.8s",
  },
  {
    id: "oil-gas",
    label: "Oil & gas",
    src: "/employer-types/oil-gas.jpg",
    top: "34%",
    left: "9%",
    duration: "6.0s",
    delay: "0.5s",
  },
  {
    id: "manufacturing",
    label: "Warehousing",
    src: "/employer-types/manufacturing.jpg",
    bottom: "22%",
    right: "10%",
    duration: "6.3s",
    delay: "0.2s",
  },
];

export default function EmployerFloatingBadges() {
  return <FloatingBadges badges={BADGES} />;
}
