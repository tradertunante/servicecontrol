import Link from "next/link";

export default function HelpButton() {
  return (
    <div data-no-print>
      <Link
        href="/help"
        aria-label="Centro de ayuda"
        title="Centro de ayuda"
        className="fixed bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-[#185FA5] text-white shadow-lg hover:bg-[#378ADD] transition-colors text-[15px] font-bold select-none"
      >
        ?
      </Link>
    </div>
  );
}