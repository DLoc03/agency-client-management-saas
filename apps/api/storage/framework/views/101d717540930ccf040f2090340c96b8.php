<!DOCTYPE html>
<html lang="en">
<body>
    <p>Hello <?php echo e($recipientName); ?>,</p>
    <p><?php echo e(__('mail.notifications.'.$type.'.body', $data)); ?></p>
    <?php if($agencyName): ?>
    <p>— <?php echo e($agencyName); ?> on Brewbase</p>
    <?php else: ?>
    <p>— Brewbase</p>
    <?php endif; ?>
</body>
</html>
<?php /**PATH /home/hatch/workspace/agency-saas-work/be009/apps/api/resources/views/emails/notification.blade.php ENDPATH**/ ?>