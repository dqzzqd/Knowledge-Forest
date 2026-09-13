import Link from "next/link";
import "./SiteNav.css";

const LINKS = [
  { href: "/forest", label: "森林" },
  { href: "/diary", label: "农夫日记" },
  { href: "/report", label: "光合作用" },
];

export default function SiteNav({ current }: { current: string }) {
  return (
    <nav className="sitenav" aria-label="页面导航">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="sitenav__link"
          aria-current={link.href === current ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
