import type { GetServerSideProps } from "next";

const OPENAI_APPS_CHALLENGE_TOKEN = "ctJgsXLozZrOEjRF-WSYoxZH-7oS6_QtKKk5Uasopng";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.write(OPENAI_APPS_CHALLENGE_TOKEN);
  res.end();

  return { props: {} };
};

export default function OpenAiAppsChallenge() {
  return null;
}
