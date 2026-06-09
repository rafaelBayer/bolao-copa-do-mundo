type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/82 shadow-xl shadow-slate-950/20 backdrop-blur light:border-slate-200 light:bg-white light:shadow-slate-200/70 ${className}`}
    >
      {children}
    </section>
  );
}
