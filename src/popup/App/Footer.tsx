import cn from '../../helpers/classnames';
import styles from './Footer.module.css';
import { setConversationModeFromContent } from '../../helpers/chromeMessages';

const Footer = ({
  className = '',
  conversationModeActive,
}: {
  className?: string;
  conversationModeActive: boolean;
}) => {
  const handleToggle = async (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    console.log('Conversational mode toggled:', checked);

    try {
      await setConversationModeFromContent(checked);
      console.log('Conversational mode message sent successfully');

      if (checked) {
        console.log('Closing popup...');
        window.close();
      }
    } catch (error) {
      console.error('Failed to toggle conversational mode:', error);
    }
  };

  return (
    <footer className={cn(className, styles.root)}>
      <label className={styles.label}>
        <input
          type="checkbox"
          id="conversationMode"
          defaultChecked={conversationModeActive}
          onChange={handleToggle}
        />
        activate conversation mode
      </label>
    </footer>
  );
};
export default Footer;
