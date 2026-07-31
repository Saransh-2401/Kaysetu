"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // "end start" (rather than the default "end end") makes the scroll range equal
  // to the container's own height instead of height-minus-viewport. That range
  // stays valid on tall phones, where a fixed-height container is shorter than
  // the viewport and the default offset collapses to nothing — which is why the
  // container below can be sized to its content rather than padded out to 80rem.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Both ranges top out at 1 so the card can never render wider than its
  // track — a >1 scale used to push the mockup off-screen at ~1024px.
  const scaleDimensions = () => (isMobile ? [0.95, 1] : [0.96, 1]);
  // A 20deg tilt eats too much vertical room on a short phone card.
  const rotateDimensions = () => (isMobile ? [10, 0] : [20, 0]);

  const rotate = useTransform(scrollYProgress, [0, 1], rotateDimensions());
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="relative flex w-full items-center justify-center px-2 py-8 sm:px-6 sm:py-12 md:px-12 md:py-16 lg:px-20 lg:py-20"
      ref={containerRef}
    >
      <div
        className="relative w-full"
        style={{
          perspective: "1000px",
        }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent }: any) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="div mx-auto max-w-5xl text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
      }}
      className="mx-auto mt-5 h-[26rem] w-full max-w-5xl rounded-2xl xs:h-[29rem] sm:mt-8 sm:h-[34rem] md:mt-12 md:h-[38rem] lg:h-[40rem]"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl">
        {children}
      </div>
    </motion.div>
  );
};
