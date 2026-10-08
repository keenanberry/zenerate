import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Zenerate",
};

/**
 * Every claim on this page describes how the code actually behaves -- the
 * cookie list, the absence of analytics, what each provider receives. Change
 * the behaviour (add analytics, a new provider, a deletion UI) and this page
 * must change in the same PR.
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: October 8, 2026</p>

      <p>
        Zenerate is operated by Keenan Berry, an individual based in Missouri,
        United States, who is the controller of your personal data. This
        policy explains what data Zenerate collects, why, who it is shared
        with, and the choices you have. In it, &ldquo;I&rdquo; and
        &ldquo;me&rdquo; refer to the operator. See also the{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>What I collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email address and password. The
          password is stored only as a secure hash by the authentication
          provider; I never see it.
        </li>
        <li>
          <strong>Your content:</strong> the prompts you write, the meditation
          scripts and audio generated from them, titles, settings, whether
          each meditation is public, and your favorites and collections.
        </li>
        <li>
          <strong>Usage records:</strong> a log of when you generate scripts
          and audio, used to enforce usage limits.
        </li>
        <li>
          <strong>Technical data:</strong> like any website, the servers that
          host Zenerate receive your IP address, browser type and the pages
          you request, which appear in hosting logs.
        </li>
      </ul>
      <p>
        I do not use analytics, advertising or tracking tools, and I do not
        sell your data or share it for advertising.
      </p>

      <h2>How I use it</h2>
      <ul>
        <li>
          To provide the service: signing you in, generating and storing your
          meditations, and playing them back. This is necessary to perform
          the contract in the <Link href="/terms">Terms</Link>.
        </li>
        <li>
          To keep it running safely: enforcing usage limits, preventing
          abuse, and fixing problems. This is my legitimate interest in
          operating a secure, fair service.
        </li>
        <li>
          To contact you about your account, such as confirming your email
          address or telling you about material changes to these policies.
        </li>
      </ul>

      <h2>Service providers that process your data</h2>
      <p>
        Zenerate relies on these companies to run. Each receives only what it
        needs for its part of the service. Their own privacy policies govern
        how they handle data.
      </p>
      <ul>
        <li>
          <strong>Supabase</strong>: database, authentication and file
          storage. Holds your account data, your content, generated audio and
          usage records. (
          <a href="https://supabase.com/privacy">Supabase privacy policy</a>)
        </li>
        <li>
          <strong>Vercel</strong>: hosts the website and runs the audio
          processing. Receives technical data with every request, and your
          script while audio is being produced. (
          <a href="https://vercel.com/legal/privacy-policy">
            Vercel privacy policy
          </a>
          )
        </li>
        <li>
          <strong>Anthropic</strong>: the AI model that writes meditation
          scripts. Receives the prompt and settings you submit. (
          <a href="https://www.anthropic.com/legal/privacy">
            Anthropic privacy policy
          </a>
          )
        </li>
        <li>
          <strong>ElevenLabs</strong>: converts scripts into spoken audio.
          Receives the text of your script. (
          <a href="https://elevenlabs.io/privacy-policy">
            ElevenLabs privacy policy
          </a>
          )
        </li>
      </ul>
      <p>
        Your email address and password are never sent to Anthropic or
        ElevenLabs. Even so, please do not include sensitive personal
        information, such as health details or other people&rsquo;s private
        information, in your prompts.
      </p>
      <p>
        I may also disclose data if required by law, or to protect the rights
        and safety of users or the service.
      </p>

      <h2>Public meditations</h2>
      <p>
        Meditations are private by default. If you make one public, its
        title, prompt, script and audio can be seen and played by anyone,
        including people without an account, and may be indexed by search
        engines. Your email address is never shown. You can make a meditation
        private again at any time, though copies others made or that search
        engines cached while it was public are outside my control.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        Zenerate uses only what it needs to work, so there is no cookie
        banner:
      </p>
      <ul>
        <li>
          <strong>Authentication cookies</strong> keep you signed in. They are
          set when you sign in and removed when you sign out.
        </li>
        <li>
          <strong>A theme preference</strong> (light or dark) is saved in
          your browser&rsquo;s local storage and never leaves your device.
        </li>
      </ul>

      <h2>How long I keep data</h2>
      <ul>
        <li>
          Account data, content and usage records are kept while your account
          exists.
        </li>
        <li>
          A meditation you delete is removed from the live database right
          away.
        </li>
        <li>
          When your account is deleted, your account data, meditations,
          generated audio, collections and usage records are deleted.
        </li>
        <li>
          Backups may contain deleted data for up to 30 days before they are
          removed.
        </li>
        <li>
          Hosting logs are kept by Vercel for a short period under its own
          retention policy.
        </li>
      </ul>

      <h2>Your rights and choices</h2>
      <p>
        Wherever you live, you can ask me to access, correct, export or delete
        your personal data. If you are in the European Economic Area, the
        United Kingdom or another place with similar laws, you also have the
        right to object to or restrict processing, and to lodge a complaint
        with your local data protection authority.
      </p>
      <p>
        To delete your account or make any other request, email{" "}
        <a href="mailto:privacy@zeneratestudio.com">
          privacy@zeneratestudio.com
        </a>{" "}
        from the address on your account. I will respond within 30 days. You
        can delete individual meditations yourself at any time.
      </p>

      <h2>International transfers</h2>
      <p>
        Zenerate is operated from the United States, and its service providers
        may process data in the United States and other countries. Where data
        protection law requires it, transfers rely on the safeguards those
        providers offer, such as Standard Contractual Clauses.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Each account can reach only its own
        private data, and generated audio is stored privately and served
        through short-lived links. No system is perfectly secure, but I take
        reasonable steps to protect your data and will notify affected users
        of a breach where the law requires.
      </p>

      <h2>Children</h2>
      <p>
        Zenerate is not intended for anyone under 16, and I do not knowingly
        collect data from them. If you believe someone under 16 has created
        an account, contact me and I will delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        I may update this policy. The date at the top shows when it last
        changed. For material changes, I will give notice through the
        service or by email before they take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Keenan Berry, operator of Zenerate:{" "}
        <a href="mailto:privacy@zeneratestudio.com">
          privacy@zeneratestudio.com
        </a>
      </p>
    </>
  );
}
