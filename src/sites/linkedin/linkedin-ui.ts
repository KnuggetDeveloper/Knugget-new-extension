export class LinkedInUI {
    private readonly buttonClass = 'knugget-save-button';
    
    injectSaveButton(postElement: Element, onSave: () => void): void {
      // Check if button already exists
      if (postElement.querySelector(`.${this.buttonClass}`)) {
        return;
      }
      
      const button = this.createSaveButton(onSave);
      const insertionPoint = this.findInsertionPoint(postElement);
      
      if (insertionPoint) {
        insertionPoint.appendChild(button);
      }
    }
  
    private createSaveButton(onSave: () => void): HTMLElement {
      const button = document.createElement('button');
      button.className = `${this.buttonClass} knugget-linkedin-button`;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z"/>
        </svg>
        Save to Knugget
      `;
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSave();
      });
      
      return button;
    }
  
    private findInsertionPoint(postElement: Element): Element | null {
      // Look for action buttons container
      const actionSelectors = [
        '.feed-shared-social-action-bar',
        '.update-components-linkedin-reactions-bar',
        '.social-action',
        '.feed-shared-actions-bar'
      ];
      
      for (const selector of actionSelectors) {
        const container = postElement.querySelector(selector);
        if (container) {
          // Create our own container within the actions area
          let knuggetContainer = container.querySelector('.knugget-actions-container');
          if (!knuggetContainer) {
            knuggetContainer = document.createElement('div');
            knuggetContainer.className = 'knugget-actions-container';
            container.appendChild(knuggetContainer);
          }
          return knuggetContainer;
        }
      }
      
      // Fallback: append to post element
      return postElement;
    }
  
    showSaving(postElement: Element): void {
      const button = postElement.querySelector(`.${this.buttonClass}`) as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.innerHTML = `
          <div class="knugget-spinner"></div>
          Saving...
        `;
      }
    }
  
    showSuccess(postElement: Element): void {
      const button = postElement.querySelector(`.${this.buttonClass}`) as HTMLButtonElement;
      if (button) {
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
          </svg>
          Saved!
        `;
        button.classList.add('success');
        
        setTimeout(() => {
          button.disabled = false;
          button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3Z"/>
            </svg>
            Save to Knugget
          `;
          button.classList.remove('success');
        }, 3000);
      }
    }
  
    showError(message: string): void {
      // Show user-friendly error notification
      this.showNotification(`Error: ${message}`, 'error');
    }
  
    showAuthRequired(): void {
      this.showNotification('Please sign in to save posts', 'info');
      
      // Open login page
      chrome.runtime.sendMessage({
        type: 'OPEN_LOGIN_PAGE',
        payload: { url: window.location.href }
      });
    }
  
    private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
      const notification = document.createElement('div');
      notification.className = `knugget-notification knugget-notification-${type}`;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
  }