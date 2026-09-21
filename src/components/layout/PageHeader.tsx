import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  showMenuButton?: boolean;
}

export function PageHeader({ title, showMenuButton = true }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {showMenuButton && (
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Menu size={24} />
        </Button>
      )}
    </div>
  );
}
