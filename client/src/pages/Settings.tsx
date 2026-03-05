import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

type SettingsFormValues = {
  currency: "USD" | "EUR" | "GBP";
  theme: "light" | "dark";
  timezone: string;
  forecastingDays: number;
};

export default function Settings() {
  const { data: preferences, isLoading } = trpc.preferences.get.useQuery();
  const utils = trpc.useUtils();
  const { theme: activeTheme } = useTheme();

  const { register, handleSubmit, setValue, watch, reset, formState } =
    useForm<SettingsFormValues>({
      defaultValues: {
        currency: "USD",
        theme: "light",
        timezone: "UTC",
        forecastingDays: 30,
      },
    });

  const mutation = trpc.preferences.update.useMutation({
    onSuccess: async () => {
      toast.success("Preferences saved");
      await Promise.all([
        utils.preferences.get.invalidate(),
        utils.analytics.dashboard.invalidate(),
        utils.analytics.summary.invalidate(),
      ]);
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!preferences) return;
    reset({
      currency: (preferences.currency as SettingsFormValues["currency"]) || "USD",
      theme: (preferences.theme as SettingsFormValues["theme"]) || "light",
      timezone: preferences.timezone || "UTC",
      forecastingDays: preferences.forecastingDays || 30,
    });
  }, [preferences, reset]);

  const selectedTheme = watch("theme");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", selectedTheme === "dark");
    localStorage.setItem("theme", selectedTheme);
  }, [selectedTheme, activeTheme]);

  const onSubmit = (data: SettingsFormValues) => mutation.mutate(data);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-40" />
          <Card className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage display, currency and forecasting preferences.
          </p>
        </header>

        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={watch("currency")}
                onValueChange={value =>
                  setValue("currency", value as SettingsFormValues["currency"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="currency" aria-label="Select currency" className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={watch("theme")}
                onValueChange={value =>
                  setValue("theme", value as SettingsFormValues["theme"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="theme" aria-label="Select theme" className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="UTC"
                aria-label="Timezone"
                {...register("timezone", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forecastingDays">Forecast horizon (days)</Label>
              <Input
                id="forecastingDays"
                type="number"
                min={1}
                max={365}
                aria-label="Forecasting days"
                {...register("forecastingDays", { valueAsNumber: true, min: 1, max: 365 })}
              />
            </div>

            <Button type="submit" disabled={!formState.isDirty || mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save preferences"}
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
