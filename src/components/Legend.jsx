function Legend() {
  return (
    <header className="absolute top-0 left-0">
      <section className="flex flex-col gap-1 sm:gap-0 lg:gap-2 text-xs sm:text-sm lg:text-base">
        <div className="flex justify-center gap-2">
          <div className="size-4 sm:size:5 lg:size-6 bg-[#007789]" />
          <div>Areas with Vitamin Angel Partnership</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-4 sm:size:5 lg:size-6 bg-[#cccccc]" />
          <div>Areas of Opportunity</div>
        </div>
      </section>
    </header>
  );
}

export default Legend;
