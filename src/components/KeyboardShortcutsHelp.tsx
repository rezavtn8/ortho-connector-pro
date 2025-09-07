import React, { useState } from 'react';
import { AccessibleDialog } from '@/components/ui/accessible-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Keyboard, HelpCircle } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Alt', '1'], description: 'Go to Dashboard' },
      { keys: ['Alt', '2'], description: 'Go to Offices' },
      { keys: ['Alt', '3'], description: 'Go to Sources' },
      { keys: ['Alt', '4'], description: 'Go to Analytics' },
      { keys: ['/'], description: 'Focus search input' },
    ]
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['R'], description: 'Refresh current page data' },
      { keys: ['Escape'], description: 'Close dialogs/modals' },
      { keys: ['Enter'], description: 'Activate focused element' },
      { keys: ['Space'], description: 'Activate buttons/checkboxes' },
    ]
  },
  {
    title: 'Forms',
    shortcuts: [
      { keys: ['Tab'], description: 'Move to next field' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous field' },
      { keys: ['Enter'], description: 'Submit form (when focused on submit button)' },
    ]
  },
  {
    title: 'Help',
    shortcuts: [
      { keys: ['?'], description: 'Show this help dialog' },
    ]
  }
];

interface KeyboardShortcutsHelpProps {
  trigger?: React.ReactNode;
}

export function KeyboardShortcutsHelp({ trigger }: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false);

  const defaultTrigger = (
    <Button 
      variant="outline" 
      size="sm" 
      className="gap-2"
      aria-label="Show keyboard shortcuts help"
    >
      <Keyboard className="w-4 h-4" aria-hidden="true" />
      Shortcuts
    </Button>
  );

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger || defaultTrigger}
      </div>
      
      <AccessibleDialog
        open={open}
        onOpenChange={setOpen}
        title="Keyboard Shortcuts"
        description="Navigate and interact with the application using these keyboard shortcuts"
      >
        <div className="space-y-6 max-h-96 overflow-y-auto custom-scrollbar">
          {shortcutGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{group.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {group.shortcuts.map((shortcut, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <kbd className="px-2 py-1 text-xs">{key}</kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                Accessibility Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Use Tab to navigate between interactive elements</p>
                <p>• Use arrow keys within tables and lists</p>
                <p>• Press Enter or Space to activate buttons</p>
                <p>• Use Escape to close dialogs and dropdowns</p>
                <p>• Screen readers will announce important changes</p>
                <p>• All form fields have proper labels and descriptions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AccessibleDialog>
    </>
  );
}