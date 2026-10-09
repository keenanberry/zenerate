import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Zenerate",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: October 8, 2026</p>

      <p>
        Zenerate is a free hobby project run by Keenan Berry, an individual,
        not a company. By using it, you agree to these terms and to the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>The short version</h2>
      <p>
        I can change, pause or shut down Zenerate at any time, for any reason,
        with or without notice, and your meditations may be deleted when that
        happens. Keep your own copy of anything you want to keep.
      </p>

      <h2>Your account</h2>
      <p>
        You must be at least 16 to create an account. Keep your password safe;
        you are responsible for what happens under your account.
      </p>

      <h2>Your content</h2>
      <p>
        You own the prompts you write and the meditations generated for you.
        You let me store and process them to run the service, and, if you make
        a meditation public, show and play it to anyone who visits Zenerate.
      </p>

      <h2>Be decent</h2>
      <p>
        Do not use Zenerate for anything illegal, hateful, sexually explicit,
        harassing, or that encourages violence or self-harm. Do not abuse the
        service or get around its usage limits. I may remove any content or
        close any account at my discretion.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Meditations are written and voiced by AI. They may be inaccurate or
        unsuitable, and they are not medical, psychological or therapeutic
        advice. Do not listen while driving or doing anything that needs your
        full attention.
      </p>

      <h2>No warranties</h2>
      <p className="uppercase">
        Zenerate is provided &ldquo;as is&rdquo;, without warranties of any
        kind. To the fullest extent permitted by law, I am not liable for any
        indirect or consequential damages or lost data, and my total liability
        for any claim is limited to US $50.
      </p>

      <h2>Everything else</h2>
      <p>
        These terms are governed by Missouri law, and disputes go to courts in
        Missouri. I may update these terms; the date above shows the latest
        version. If Zenerate is ever transferred to a company or a new
        operator, these terms transfer with it. Questions:{" "}
        <a href="mailto:privacy@zeneratestudio.com">
          privacy@zeneratestudio.com
        </a>
        .
      </p>
    </>
  );
}
