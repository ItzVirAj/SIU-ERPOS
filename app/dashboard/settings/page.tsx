import ProfileSettingsPage from "@/components/settings/profile-settings-page";

export const metadata = {
  title: "Profile & Settings | SketchItUp OS",
  description: "Manage your details, security settings, browsers, and personal preferences.",
};

export default function SettingsRoute() {
  return <ProfileSettingsPage />;
}
