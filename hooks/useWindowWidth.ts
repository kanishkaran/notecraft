import { useState, useEffect } from "react";

export function useWindowWidth(): number {
  const [width, setWidth] = useState(1024); // match server — real value set after mount
  useEffect(() => {
    setWidth(window.innerWidth);
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}
