import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description?: string;
}

/**
 * Sets document title and meta description for each page.
 * Keeps the brand suffix consistent across all routes.
 */
export default function SEOHead({ title, description }: SEOHeadProps) {
  useEffect(() => {
    document.title = `${title} | ForgeLab`;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", description);
      }
    }
  }, [title, description]);

  return null;
}
