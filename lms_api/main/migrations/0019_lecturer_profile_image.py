# Generated by Django 4.2.16 on 2025-03-19 06:28

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0018_alter_course_featured_img'),
    ]

    operations = [
        migrations.AddField(
            model_name='lecturer',
            name='profile_image',
            field=models.ImageField(blank=True, null=True, upload_to='lecturer_profiles/'),
        ),
    ]
