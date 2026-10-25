import { Shuffle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../../components/ui/sheet';
import type { ResourceForm } from '../lib/resource-form';
import {
  uniqueNamesGenerator,
  Config,
  adjectives,
  names,
} from 'unique-names-generator';

const config: Config = {
  dictionaries: [adjectives, names],
  separator: '-',
  length: 2,
  style: 'lowerCase',
};

interface DetailSheetProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  editing: boolean;
  form: ResourceForm;
  setForm: (form: ResourceForm) => void;
  saving?: boolean;
  handleSave: () => void;
}
export const DetailSheet = ({
  open,
  setOpen,
  editing,
  form,
  setForm,
  handleSave,
  saving,
}: DetailSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {editing ? 'Edit Resource' : 'Create Resource'}
          </SheetTitle>
          <SheetDescription>
            Creates or verifies the broker resource, then saves its MongoDB
            record. Existing resources are reused. Subscriptions are added,
            never removed.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 mt-6">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Name</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm({ ...form, name: uniqueNamesGenerator(config) })
                }
                className="h-7 text-xs"
              >
                <Shuffle className="mr-1 h-3 w-3" />
                Random Name
              </Button>
            </div>
            <Input
              id="name"
              placeholder="Name"
              value={form.name}
              disabled={editing}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Provider</Label>
              <Select
                disabled={editing}
                value={form.provider}
                onValueChange={(v: 'aws' | 'azure') =>
                  setForm({ ...form, provider: v, subscriptions: undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="azure">Azure</SelectItem>
                  <SelectItem value="aws">AWS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Type</Label>
              <Select
                disabled={editing}
                value={form.type}
                onValueChange={(v: 'queue' | 'topic') =>
                  setForm({ ...form, type: v, subscriptions: undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="queue">Queue</SelectItem>
                  <SelectItem value="topic">Topic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.provider === 'azure' && form.type === 'topic' && (
            <div className="grid gap-2">
              <Label htmlFor="subscriptions">
                Subscriptions (comma-separated)
              </Label>
              <Input
                id="subscriptions"
                placeholder="logging-service, analytics-processor"
                value={form.subscriptions?.join(', ') ?? ''}
                onChange={(event) =>
                  setForm({
                    ...form,
                    subscriptions: event.target.value
                      .split(',')
                      .map((name) => name.trim()),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Create the subscription your receiver listens to; a topic alone
                does not create a subscription.
              </p>
            </div>
          )}
          <Button
            disabled={saving || !form.name.trim()}
            onClick={handleSave}
            className="w-full mt-4"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
